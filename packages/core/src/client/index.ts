import { Injectable, Injector, ConstructorOf, Provider } from '@opensumi/di';
import {
  BrowserModule,
  ClientApp as BasicClientApp,
  IAppRenderer,
  IClientAppOpts,
  PreferenceProviderProvider,
  PreferenceScope,
  PreferenceProvider,
} from '@opensumi/ide-core-browser';
import { BackService, BasicModule } from '@opensumi/ide-core-common';
import { WSChannelHandler } from '@opensumi/ide-connection/lib/browser';

import { FCServiceCenter, ClientPort, initFCService } from '../connection';
import { KaitianExtFsProvider, KtExtFsProviderContribution } from './extension';
import { TextmateLanguageGrammarContribution } from './textmate-language-grammar/index.contribution';
import { ILanguageGrammarRegistrationService } from './textmate-language-grammar/base';
import { LanguageGrammarRegistrationService } from './textmate-language-grammar/language-grammar.service';
import { injectDebugPreferences } from './debug';
import { IServerApp, RootFS } from '../common';
import { IServerAppOpts, ServerApp } from '../server/core/app';
import { isBackServicesInBrowser } from '../common/util';
import {
  FileTreeCustomContribution,
  EditorActionEventContribution,
  MenuConfigContribution,
} from './custom';
import { EditorEmptyContribution } from './editor-empty/editor-empty.contribution';
import { WelcomeContribution } from './welcome/welcome.contributon';
import { FileSchemeContribution } from './file-scheme/index.contribution';
import {
  MonacoCodeService,
  IMonacoCodeService,
  codeServiceEditor,
} from './override/codeEditorService';
import { BreadCrumbServiceImplOverride, IBreadCrumbService } from './override/breadcrumb.service';
import { SearchContribution } from './search/index.contribution';
import {
  MonacoSnippetSuggestProviderOverride,
  MonacoSnippetSuggestProvider,
} from './override/snippet.service';

export * from './override/codeEditorService';

export { ExtensionManagerModule as ExtensionClientManagerModule } from './extension-manager';

export * from './extension';

export { TextmateLanguageGrammarContribution, LanguageGrammarRegistrationService };

export type ModuleConstructor = ConstructorOf<BrowserModule>;

@Injectable()
export class ClientModule extends BrowserModule {
  providers: Provider[] = [
    KaitianExtFsProvider,
    KtExtFsProviderContribution,
    TextmateLanguageGrammarContribution,
    {
      token: ILanguageGrammarRegistrationService,
      useClass: LanguageGrammarRegistrationService,
    },
    FileTreeCustomContribution,
    EditorActionEventContribution,
    EditorEmptyContribution,
    WelcomeContribution,
    MenuConfigContribution,
    FileSchemeContribution,
    SearchContribution,
    {
      token: MonacoCodeService,
      useValue: codeServiceEditor,
    },
    {
      token: IMonacoCodeService,
      useClass: MonacoCodeService,
    },
    {
      token: IBreadCrumbService,
      useClass: BreadCrumbServiceImplOverride,
      override: true,
    },
    {
      token: MonacoSnippetSuggestProvider,
      useClass: MonacoSnippetSuggestProviderOverride,
      override: true,
    },
  ];
  preferences = injectDebugPreferences;
}

export interface IAppOpts extends IClientAppOpts, IServerAppOpts {}

export { IClientAppOpts };

export class ClientApp extends BasicClientApp {
  private clearInjector: () => void;

  constructor(opts: IAppOpts) {
    super(opts);
    this.initServer(opts);
    this.initCodeServiceEditor();
  }

  initCodeServiceEditor() {
    this.clearInjector = codeServiceEditor.setInjector(this.injector);
  }

  private initServer(opts: IAppOpts) {
    const serverApp = new ServerApp({
      injector: this.injector,
      modules: this.modules,
      appConfig: this.config,
      logDir: opts.logDir,
      logLevel: opts.logLevel,
      LogServiceClass: opts.LogServiceClass,
      extensionMetadata: opts.extensionMetadata,
      blockPatterns: opts.blockPatterns,
    });
    this.injector.addProviders({
      token: IServerApp,
      useValue: serverApp,
    });
  }

  public async start(
    container: HTMLElement | IAppRenderer,
    type?: 'electron' | 'web'
  ): Promise<void> {
    // 先启动 server 进行必要的初始化，应用的权限等也在 server 中处理
    const serverApp: IServerApp = this.injector.get(IServerApp);
    await serverApp.start();
    this.setWorkspaceReadOnly(serverApp.rootFS);

    bindConnectionService(this.injector, this.modules);
    // 避免 KaitianExtensionClientAppContribution.onStop 报错
    this.injector.addProviders({
      token: WSChannelHandler,
      useValue: { clientId: 'alex' },
    });
    return super.start(container, type);
  }

  /**
   * 根据文件系统来设置空间是否只读
   */
  private setWorkspaceReadOnly(rootFS: RootFS) {
    const workspaceFS = rootFS._getFs(this.config.workspaceDir);
    if (workspaceFS.fs.isReadOnly()) {
      const providerFactory: PreferenceProviderProvider = this.injector.get(
        PreferenceProviderProvider
      );
      const defaultPreference: PreferenceProvider = providerFactory(PreferenceScope.Default);
      defaultPreference.setPreference('editor.readonlyFiles', [
        `${this.config.workspaceDir}/**`,
        ...(defaultPreference.get<string[]>('editor.readonlyFiles') || []),
      ]);
    }
  }
  async dispose() {
    super.dispose();
    this.clearInjector();
  }
}

export async function bindConnectionService(injector: Injector, modules: ModuleConstructor[]) {
  const clientCenter = new FCServiceCenter(ClientPort);

  const { getFCService } = initFCService(clientCenter);

  const backServiceList: BackService[] = [];

  for (const module of modules) {
    const moduleInstance = injector.get(module) as BasicModule;
    if (moduleInstance.backServices) {
      for (const backService of moduleInstance.backServices) {
        if (isBackServicesInBrowser(backService)) {
          backServiceList.push(backService);
        }
      }
    }
  }

  for (const backService of backServiceList) {
    const { servicePath } = backService;
    const fcService = getFCService(servicePath);

    const injectService = {
      token: servicePath,
      useValue: fcService,
    } as Provider;

    injector.addProviders(injectService);

    if (backService.clientToken) {
      const clientService = injector.get(backService.clientToken);
      fcService.onRequestService(clientService);
    }
  }
}
