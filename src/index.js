/** @typedef {import("@babel/core").PluginObj} PluginObj */
import { addDefault, addSideEffect } from '@babel/helper-module-imports';

/**
 * 这里仅仅使用了ImportDeclaration和CallExpression这两个hook
 * 如果你只是单纯的import { Button } from 'antd-design-vue',但是并没有使用到Button,一般情况下,
 * 上层的打包工具（比如webpack）会给你做tree shaking删掉,不会对这个Button进行打包,
 * 这并不是按需加载插件做的事情,按需加载主要做:
 *
 * 进入a.js文件
 * ImportDeclaration  收集按需加载的包
 * CallExpression     将按需加载的包的js模块进行转化、添加对应的js和css副作用
 * 退出a.js文件,并将ImportDeclaration收集的代码删除
 *
 * 举个例子总结:在编译阶段,将a.js里面的import { Button } from 'antd-design-vue'这行代码删除,然后插入var Button = require('antd-design-vue/lib/Button')这行代码
 */
export default function () {
  let nodeMap = Object.create(null);

  function handleImport({
    libraryName,
    libraryDirectory,
    style,
    argName,
    path,
  }) {
    console.log('\n===handleImport===', argName);
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
    // https://babeljs.io/docs/en/v7-migration-api#babelcore,addDefault的前身是path.hub.file.addImport,7.x后删除了。
    const res = addDefault(
      path,
      `${libraryName}/${libraryDirectory}/${kebabCaseName}`,
      { nameHint: argName }
    );

    // 处理css
    if (style === true) {
      addSideEffect(
        path,
        `${libraryName}/${libraryDirectory}/${kebabCaseName}/style/index.js`
      );
    } else if (style === 'css') {
      addSideEffect(
        path,
        `${libraryName}/${libraryDirectory}/${kebabCaseName}/style/css.js`
      );
    }

    // { type: 'Identifier', name: '_Alert' }
    return res;
  }

  /** @type {PluginObj} */
  const obj = {
    // 每个文件都会走一遍visitor
    visitor: {
      /**
       * Program可以理解为ast的根节点
       */
      Program: {
        /**
         * nodeMap需要每次进入一个文件都重置nodeMap,否则会导致出问题(在一个文件里handleImport执行了上一个文件的handleImport操作)
         * 举例,入口文件: import {Alert} from 'antd-design-vue';import {test} from 'b';console.log(Alert);
         * 然后b.js: export const test = () => {let Alert = 1;console.log(Alert);};
         * 如果不在每个文件的Program.enter里面重置收集到的import节点的话,那么babel执行到b.js的时候,CallExpression判断到Alert在nodeMap里面存在,
         * 就会将console.log(Alert)的Alert节点替换成ant-design-vue/lib/alert,导致打印的结果不是console.log(1)
         */
        // eslint-disable-next-line
        enter(path, state) {
          // console.log('enter', state.filename);
          /**
           * 如果单纯的{},MemberExpression的时候,node.object.name会存在Object原型的方法,如:toString/hasOwnProperty/valueOf等,
           * 然后在判断nodeMap['toString']时,就会找到nodeMap原型上面的toString,然后导致报错
           */
          nodeMap = Object.create(null);
        },
        // eslint-disable-next-line
        exit(path, state) {
          Object.keys(nodeMap).forEach((key) => {
            // console.log('exit', state.filename);
            // 将import { Button, Alert } from 'antd-design-vue'移除,否则会造成重复打包
            !nodeMap[key].removed && nodeMap[key].remove();
          });
        },
      },

      /**
       * 引入模块的时候会执行这个函数,如import { Button, Alert } from 'antd-design-vue'
       * https://astexplorer.net/#/gist/f3dfdfcd473677c23808018f4728c1f3/f6afa7a94803daba91a7f23c891eae7eb433b3bb
       */
      ImportDeclaration(path, state) {
        const { node } = path;
        if (!node) return;
        // 这个value是antd-design-vue
        const { value } = node.source;
        // @ts-ignore
        const { libraryName } = state.opts;
        if (value === libraryName) {
          // 这个node.specifiers是[Button,Alert]
          node.specifiers.forEach((spec) => {
            // 这个spec.local.name是Button、Alert
            nodeMap[spec.local.name] = path;
          });
        }
      },

      /**
       * 定义变量相关的会执行这个函数,如:import { Alert } from 'antd-design-vue'; let a = Alert;的时候
       */
      VariableDeclarator(path, state) {
        const { node } = path;
        // @ts-ignore
        const { libraryName, libraryDirectory, style = false } = state.opts;
        const init = node.init;
        if (init) {
          // @ts-ignore
          const { name: argName } = init;
          // 当前参数里使用了ImportDeclaration里的东西
          if (nodeMap[argName]) {
            const res = handleImport({
              libraryName,
              libraryDirectory,
              style,
              argName,
              path,
            });
            // init = res; // WARN 这是错误的,切记js的引用变化
            node.init = res;
          }
        }
      },

      /**
       * 调用表达式的时候会执行这个函数,如:import { Button, Alert } from 'antd-design-vue'; console.log(Button,Alert),这里调用了console.log这个方法
       */
      CallExpression(path, state) {
        // state.opts:能获取babel.config.js里传进来的参数:
        // state.cwd:node进程工作目录？
        // state.file:当前匹配的文件
        // state.filename:当前匹配的文件路径,如:'/Users/huangshuisheng/Desktop/hss/github/webpack-multi-static/src/page/index.ts'
        const { node } = path;
        // @ts-ignore
        const { libraryName, libraryDirectory, style = false } = state.opts;
        // 此时的node.arguments是Identifier节点数组（【Identifier对象（Button）,Identifier对象（Alert）】）
        // 这里主要是修改调用的Button和Alert的Identifier对象
        /**
         * 可以理解为:
         * import {Button} from 'antd-design-vue';
         * console.log(Button)
         * 转换为:
         * import _Button from 'antd-design-vue/lib/button'
         * console.log(_Button)
         */
        node.arguments = node.arguments.map((arg) => {
          // 这个argName就是Button、Alert
          // @ts-ignore
          const { name: argName } = arg;

          // 如果形参里的参数在nodeMap里,则替换路径,插入依赖
          // 确保形参里面调用的Button是import的Button,而不是其他类型的Button
          // 例如:var Button={};console.log(Button);此时的Button的类型就是VariableDeclarator类型的
          if (
            nodeMap[argName] &&
            path.scope.hasBinding(argName) &&
            // @ts-ignore
            path.scope.getBinding(argName).path.type === 'ImportSpecifier'
          ) {
            const res = handleImport({
              libraryName,
              libraryDirectory,
              style,
              argName,
              path,
            });
            return res;
          }
          return arg;
        });
      },

      /**
       * 成员调用会执行这个函数,如:import { message } from 'antd-design-vue'; message.info('hi')的时候
       */
      MemberExpression(path, state) {
        const { node } = path;
        // @ts-ignore
        const { libraryName, libraryDirectory, style = false } = state.opts;
        // @ts-ignore
        const argName = node.object.name;
        if (nodeMap[argName]) {
          const res = handleImport({
            libraryName,
            libraryDirectory,
            style,
            argName,
            path,
          });
          // 这里主要是修改调用的message的Identifier对象
          // 修改node.object
          node.object = res;
        }
      },

      /**
       * 属性相关的会执行这个函数,如:import { Button } from 'antd-design-vue'; let components = { a:Button };的时候
       */
      Property(path, state) {
        const { node } = path;
        // @ts-ignore
        const { libraryName, libraryDirectory, style = false } = state.opts;
        // @ts-ignore
        const argName = node.value.name;
        if (nodeMap[argName]) {
          const res = handleImport({
            libraryName,
            libraryDirectory,
            style,
            argName,
            path,
          });
          // 修改node.value
          node.value = res;
        }
      },
    },
  };

  return obj;
}
