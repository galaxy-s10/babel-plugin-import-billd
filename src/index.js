const { addDefault, addSideEffect } = require('@babel/helper-module-imports');

/**
 * @description myName或MyName转化为my-name
 * @copy https://github.com/vueComponent/ant-design-vue/blob/HEAD/antd-tools/generator-types/src/utils.ts
 * @param {string} input
 * @return {*}
 */
const toKebabCase = (input) =>
  input.replace(
    /[A-Z]/g,
    (val, index) => (index === 0 ? '' : '-') + val.toLowerCase()
  );

/**
 * 这里仅仅使用了ImportDeclaration和CallExpression这两个hook
 * 如果你只是单纯的import { bbb } from 'aaa'，但是并没有使用到bbb，一般情况下，
 * 上层的打包工具（比如webpack）会给你做tree shaking删掉，不会对这个bbb进行打包，
 * 这并不是按需加载插件做的事情，按需加载主要做：
 *
 * 进入a.js文件
 * ImportDeclaration  收集按需加载的包
 * CallExpression     将按需加载的包的js模块进行转化、添加对应的jcss副作用
 * 退出a.js文件，并将ImportDeclaration收集的代码删除
 *
 * 举个例子总结：在编译阶段，将a.js里面的import { bbb } from 'aaa'这行代码删除，然后插入var bbb = require('aaa/lib/bbb')这行代码
 */
export default function () {
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
            // 将import { bbb, ccc } from 'aaa'移除，否则会造成重复打包
            !pathList[key].removed && pathList[key].remove();
          });
        },
      },

      /**
       * 引入模块的时候会执行这个函数，如import { bbb, ccc } from 'aaa'
       * https://astexplorer.net/#/gist/f3dfdfcd473677c23808018f4728c1f3/f6afa7a94803daba91a7f23c891eae7eb433b3bb
       */
      ImportDeclaration(path, state) {
        const { node } = path;
        if (!node) return;
        // 这个value是aaa
        const { value } = node.source;
        const { libraryName } = state.opts;
        if (value === libraryName) {
          // 这个node.specifiers是[bbb,ccc]
          node.specifiers.forEach((spec) => {
            // 这个spec.local.name是bbb、ccc
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
        const { libraryName, libraryDirectory, style = false } = state.opts;
        node.arguments = node.arguments.map((arg) => {
          const { name: argName } = arg;
          let res = {};
          Object.keys(pathList).forEach((originName) => {
            if (originName === argName) {
              const kebabCaseName = toKebabCase(originName);
              // 处理js
              res = addDefault(
                file.path,
                `${libraryName}/${libraryDirectory}/${kebabCaseName}`,
                { nameHint: kebabCaseName }
              );
              // 处理css
              if (style === true) {
                addSideEffect(
                  file.path,
                  `${libraryName}/${libraryDirectory}/${kebabCaseName}/style/index.js`
                );
              } else if (style === 'css') {
                addSideEffect(
                  file.path,
                  `${libraryName}/${libraryDirectory}/${kebabCaseName}/style/css.js`
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
