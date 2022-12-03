const { addDefault, addSideEffect } = require('@babel/helper-module-imports');

export default function () {
  // console.log(arguments)
  const pathList = {};

  return {
    // 每个文件都会走一遍visitor
    visitor: {
      /**
       * visitor的Program里的enter可以理解为，会在visitor里的所有操作执行前，执行一次enter；
       * 而exit可以理解为，在visitor里的所有操作执行完了后，会执行一次exit
       */
      Program: {
        enter(path, state) {
          console.log('enter', state.filename);
        },
        exit(path, state) {
          console.log('exit', state.filename);
          Object.keys(pathList).forEach((key) => {
            !pathList[key].removed && pathList[key].remove();
          });
        },
      },

      /**
       * 引入模块的时候会执行这个函数，如import { bbb } from 'aaa'
       */
      ImportDeclaration(path, state) {
        const { node } = path;
        if (!node) return;
        const { value } = node.source; // 这个value是aaa
        const { libraryName } = state.opts;
        if (value === libraryName) {
          node.specifiers.forEach((spec) => {
            pathList[spec.local.name] = path;
          });
        }
      },

      /**
       * 调用表达式的时候会执行这个函数，如：console.log(),这里调用了console.log这个方法
       */
      CallExpression(path, state) {
        // state.opts:能获取babel.config.js里传进来的参数：
        // state.cwd:node进程工作目录？
        // state.file:当前匹配的文件
        // state.filename:当前匹配的文件路径，如：'/Users/huangshuisheng/Desktop/hss/github/webpack-multi-static/src/page/index.ts'
        const { node } = path;
        const file =
          (path && path.hub && path.hub.file) || (state && state.file);
        const { libraryName, libraryDirectory, style = true } = state.opts;
        node.arguments = node.arguments.map((arg) => {
          const { name: argName } = arg;
          let res = {};
          Object.keys(pathList).forEach((item) => {
            if (item === argName) {
              res = addDefault(
                file.path,
                `${libraryName}/${libraryDirectory}/${item}`,
                { nameHint: item }
              );
              if (style === true) {
                addSideEffect(
                  file.path,
                  `${libraryName}/${libraryDirectory}/${item}/style/index.js`
                );
              } else if (style === 'css') {
                addSideEffect(
                  file.path,
                  `${libraryName}/${libraryDirectory}/${item}/style/css.js`
                );
              }
            }
          });
          if (Object.keys(res).length) {
            return res;
          }
          return arg;
        });
      },
    },
  };
}
