"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "getRootDirs", {
    enumerable: true,
    get: function() {
        return getRootDirs;
    }
});
var _fastglob = require("tinyglobby");
var _path = require("node:path");
/**
 * Process a Next.js root directory glob.
 */ var processRootDir = function(rootDir) {
    return (0, _fastglob.globSync)(rootDir.replace(/\\/g, '/'), {
        absolute: _path.isAbsolute(rootDir),
        onlyDirectories: true,
        expandDirectories: false
    }).map(function (directory) { return directory.replace(/\/$/, ""); });
};
var getRootDirs = function(context) {
    var rootDirs = [
        context.cwd
    ];
    var nextSettings = context.settings.next || {};
    var rootDir = nextSettings.rootDir;
    if (typeof rootDir === 'string') {
        rootDirs = processRootDir(rootDir);
    } else if (Array.isArray(rootDir)) {
        rootDirs = rootDir.map(function(dir) {
            return typeof dir === 'string' ? processRootDir(dir) : [];
        }).flat();
    }
    return rootDirs;
};
