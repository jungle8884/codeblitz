import { Injector } from '@ali/common-di'
import { ConstructorOf } from '@ali/ide-core-common'
import { IExtensionBasicMetadata } from '@alipay/spacex-shared'

import {
  ClientApp,
  ServerApp,
  EXTENSION_DIR,
  IClientAppOpts,
  NodeModule,
} from '@alipay/spacex-core'

type Options = Omit<IClientAppOpts, 'serverApp'> & {
  serverOptions: {
    modules?: ConstructorOf<NodeModule>[]
    extensionMetadata?: IExtensionBasicMetadata[]
  }
}

export async function createApp(opts: Options) {
  const clientInjector = new Injector()
  const serverInjector = new Injector()

  opts.injector = clientInjector
  opts.extensionDir = opts.extensionDir || EXTENSION_DIR
  opts.extWorkerHost =
    opts.extWorkerHost || 'https://dev.g.alicdn.com/tao-ide/ide-lite/0.0.1/worker-host.js'
  opts.editorBackgroundImage = 'https://img.alicdn.com/tfs/TB1Y6vriuL2gK0jSZFmXXc7iXXa-200-200.png'

  const serverApp = new ServerApp({
    injector: serverInjector,
    modules: opts.serverOptions.modules || [],
    workspaceDir: opts.workspaceDir,
    extensionDir: opts.extensionDir,
    extensionMetadata: opts.serverOptions.extensionMetadata,
  })

  await serverApp.start()

  const app = new ClientApp({
    ...opts,
    serverApp,
  })
  app.fireOnReload = () => {
    window.location.reload()
  }

  return app
}
