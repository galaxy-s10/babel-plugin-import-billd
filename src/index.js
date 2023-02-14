const { addDefault, addSideEffect } = require('@babel/helper-module-imports');

/**
 * 这里仅仅使用了ImportDeclaration和CallExpression这两个hook
 * 如果你只是单纯的import { Button } from 'antd'，但是并没有使用到Button，一般情况下，
 * 上层的打包工具（比如webpack）会给你做tree shaking删掉，不会对这个Button进行打包，
 * 这并不是按需加载插件做的事情，按需加载主要做：
 *
 * 进入a.js文件
 * ImportDeclaration  收集按需加载的包
 * CallExpression     将按需加载的包的js模块进行转化、添加对应的jcss副作用
 * 退出a.js文件，并将ImportDeclaration收集的代码删除
 *
 * 举个例子总结：在编译阶段，将a.js里面的import { Button } from 'antd'这行代码删除，然后插入var Button = require('antd/lib/Button')这行代码
 */
export default function () {
  let pathList = Object.create(null);

  function handleImport({
    libraryName,
    libraryDirectory,
    style,
    argName,
    file,
  }) {
    // myName或MyName转化为my-name
    function toKebabCase(input) {
      return input.replace(
        /[A-Z]/g,
        (val, index) => (index === 0 ? '' : '-') + val.toLowerCase()
      );
    }
    const kebabCaseName = toKebabCase(argName);

    // 处理js
    // https://babeljs.io/docs/en/babel-helper-module-imports#import-_hintedname-from-source
    // https://babeljs.io/docs/en/v7-migration-api#babelcore，addDefault的前身是path.hub.file.addImport，7.x后删除了。
    const res = addDefault(
      file.path,
      `${libraryName}/${libraryDirectory}/${kebabCaseName}`,
      { nameHint: argName }
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

    // { type: 'Identifier', name: '_Alert' }
    return res;
  }

  return {
    // 每个文件都会走一遍visitor
    visitor: {
      /**
       * visitor的Program里的enter可以理解为，会在visitor里的所有操作执行前，执行一次enter；
       * 而exit可以理解为，在visitor里的所有操作执行完了后，会执行一次exit
       */
      Program: {
        // pathList不能放在最外层的全局，需要每次进入一个文件都重置pathList，否则会导致报错（在一个文件里handleImport执行了上一个文件的handleImport操作）
        enter: (path, state) => {
          console.log('enter', state.filename);
          pathList = Object.create(null); // 如果单纯的{}，MemberExpression的时候，node.object.name会存在Object原型的方法，后面逻辑导致报错
        },
        exit(path, state) {
          Object.keys(pathList).forEach((key) => {
            console.log('exit', state.filename, Object.keys(pathList));
            // 将import { Button, Alert } from 'antd'移除，否则会造成重复打包
            !pathList[key].removed && pathList[key].remove();
          });
        },
      },

      /**
       * 引入模块的时候会执行这个函数，如import { Button, Alert } from 'antd'
       * 收集import的Button, Alert到pathList
       * https://astexplorer.net/#/gist/f3dfdfcd473677c23808018f4728c1f3/f6afa7a94803daba91a7f23c891eae7eb433b3bb
       */
      ImportDeclaration(path, state) {
        const { node } = path;
        if (!node) return;
        // 这个value是antd
        const { value } = node.source;
        const { libraryName } = state.opts;
        if (value === libraryName) {
          // 这个node.specifiers是[Button,Alert]
          node.specifiers.forEach((spec) => {
            // 这个spec.local.name是Button、Alert
            pathList[spec.local.name] = path;
          });
        }
      },

      /**
       * 调用表达式的时候会执行这个函数，如：import { Button, Alert } from 'antd'; console.log(Button,Alert),这里调用了console.log这个方法
       * 找传给console.log的形参，如果形参里的参数在pathList里，则替换路径，插入依赖
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
        // 此时的node.arguments是Identifier节点数组（【Identifier对象（Button）,Identifier对象（Alert）】）
        node.arguments = node.arguments.map((arg) => {
          // 这个argName就是Button、Alert
          const { name: argName } = arg;
          // 如果形参里的参数在pathList里，则替换路径，插入依赖
          if (pathList[argName]) {
            const res = handleImport({
              libraryName,
              libraryDirectory,
              style,
              argName,
              file,
            });
            // 修改Button、Alert的Identifier
            return res;
          }
          return arg;
        });
      },

      /**
       * 成员调用会执行这个函数，如：import { message } from 'antd'; message.info('hi')的时候
       */
      MemberExpression(path, state) {
        const { node } = path;
        const file =
          (path && path.hub && path.hub.file) || (state && state.file);
        const { libraryName, libraryDirectory, style = false } = state.opts;
        if (pathList[node.object.name]) {
          const res = handleImport({
            libraryName,
            libraryDirectory,
            style,
            argName: node.object.name,
            file,
          });
          // 修改node.object
          node.object = res;
        }
      },

      /**
       * 属性相关的会执行这个函数，如：import { Button } from 'antd'; let components = { a:Button };的时候
       */
      Property(path, state) {
        const { node } = path;
        const file =
          (path && path.hub && path.hub.file) || (state && state.file);
        const { libraryName, libraryDirectory, style = false } = state.opts;
        if (pathList[node.value.name]) {
          const res = handleImport({
            libraryName,
            libraryDirectory,
            style,
            argName: node.value.name,
            file,
          });
          // 修改node.value
          node.value = res;
        }
      },
    },
  };
}
