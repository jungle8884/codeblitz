import fs from 'browserfs/dist/node/core/node_fs';
import { checkOptions } from 'browserfs/dist/node/core/util';
import {
  FileSystem,
  FileSystemConstructor,
  BFSCallback,
} from 'browserfs/dist/node/core/file_system';
import * as Errors from 'browserfs/dist/node/core/api_error';

import MountableFileSystem from 'browserfs/dist/node/backend/MountableFileSystem';
import IndexedDB from 'browserfs/dist/node/backend/IndexedDB';
import InMemory from 'browserfs/dist/node/backend/InMemory';
import FolderAdapter from 'browserfs/dist/node/backend/FolderAdapter';
import OverlayFS from 'browserfs/dist/node/backend/OverlayFS';

const Backends = {
  MountableFileSystem,
  IndexedDB,
  InMemory,
  FolderAdapter,
  OverlayFS,
};

function patchCreateForCheck(fsType: FileSystemConstructor) {
  const create = fsType.Create;
  fsType.Create = function (opts?: any, cb?: BFSCallback<FileSystem>): void {
    const oneArg = typeof opts === 'function';
    const normalizedCb = oneArg ? opts : cb;
    const normalizedOpts = oneArg ? {} : opts;

    function wrappedCb(e?: Errors.ApiError): void {
      if (e) {
        normalizedCb(e);
      } else {
        create.call(fsType, normalizedOpts, normalizedCb);
      }
    }

    checkOptions(fsType, normalizedOpts, wrappedCb);
  };
}

Object.keys((key) => patchCreateForCheck(Backends[key]));

function initialize(rootfs: FileSystem) {
  return fs.initialize(rootfs);
}

export interface FileSystemConfiguration {
  fs: string;
  options?: any;
}

async function configure(config: FileSystemConfiguration) {
  const fs = await getFileSystem(config);
  if (fs) {
    initialize(fs);
  }
}

function createFileSystem<T extends FileSystemConstructor>(
  FileSystemClass: T,
  options: Parameters<T['Create']>[0]
): Promise<FileSystem> {
  return new Promise((resolve, reject) => {
    FileSystemClass.Create(options, (err: any, fs: FileSystem) => {
      if (err) {
        reject(err);
      } else {
        resolve(fs);
      }
    });
  });
}

/**
 * Retrieve a file system with the given configuration.
 * @param config A FileSystemConfiguration object. See FileSystemConfiguration for details.
 * @param shareFileSystem 是否共享 filesystem 实例，同一 fs name 使用同一个实例
 */
async function getFileSystem({ fs, options }: FileSystemConfiguration): Promise<FileSystem> {
  if (!fs) {
    throw new Errors.ApiError(
      Errors.ErrorCode.EPERM,
      'Missing "fs" property on configuration object.'
    );
  }

  if (options !== null && typeof options === 'object') {
    const props = Object.keys(options).filter((k) => k !== 'fs');
    // Check recursively if other fields have 'fs' properties.
    try {
      await Promise.all(
        props.map(async (p) => {
          const d = options[p];
          if (d !== null && typeof d === 'object' && d.fs) {
            options[p] = await getFileSystem(d);
          }
        })
      );
    } catch (e) {
      throw e;
    }
  }

  const fsc = Backends[fs];
  if (!fsc) {
    throw new Errors.ApiError(
      Errors.ErrorCode.EPERM,
      `File system ${fs} is not available in BrowserFS.`
    );
  } else {
    return createFileSystem(fsc, options);
  }
}

function addFileSystemType(name: string, fsType: FileSystemConstructor) {
  patchCreateForCheck(fsType);
  Backends[name] = fsType;
}

export { fs, FileSystem };

export const BrowserFS = {
  initialize,
  configure,
  addFileSystemType,
  createFileSystem,
  getFileSystem,
  FileSystem: {
    MountableFileSystem,
    IndexedDB,
    InMemory,
    FolderAdapter,
    OverlayFS,
  },
};
