<p align="center">
  <a href="">
    <img
      width="200"
      src="https://resource.hsslive.cn/image/1613141138717Billd.webp"
      alt="babel-plugin-import-billd logo"
    />
  </a>
</p>

<h1 align="center">
  babel-plugin-import-billd
</h1>

<p align="center">
迷你版按需加载插件
</p>

<div align="center">
<a href="https://www.npmjs.com/package/babel-plugin-import-billd"><img src="https://img.shields.io/npm/v/babel-plugin-import-billd.svg" alt="Version"></a>
<a href="https://www.npmjs.com/package/babel-plugin-import-billd"><img src="https://img.shields.io/npm/dw/babel-plugin-import-billd.svg" alt="Downloads"></a>
<a href="https://www.npmjs.com/package/babel-plugin-import-billd"><img src="https://img.shields.io/npm/l/babel-plugin-import-billd.svg" alt="License"></a>
</div>

# 简介

参考了[babel-plugin-import](https://github.com/umijs/babel-plugin-import)，实现了我认为核心的三个配置项：`libraryName`、`libraryDirectory`、`style`

# babel 插件简介

https://github.com/jamiebuilds/babel-handbook/blob/master/translations/zh-Hans/plugin-handbook.md#babel-%E7%9A%84%E5%A4%84%E7%90%86%E6%AD%A5%E9%AA%A4

- Babel 的三个主要处理步骤分别是： 解析（parse），转换（transform），生成（generate）
- 转换步骤接收 AST 并对其进行遍历，在此过程中对节点进行添加、更新及移除等操作。 这是 Babel 或是其他编译器中最复杂的过程 同时也是插件将要介入工作的部分

可以得出结论，babel 插件主要是操作 ast，而操作 ast 其实就是操作 visitor

# 案例

最粗浅的理解就是在编译阶段，将以下代码（或者说是这个文件）：

```js
import { Button } from 'ant-design-vue';
console.log(Button);
```

转换为；

```js
import Button from 'ant-design-vue/es/button';
import 'ant-design-vue/es/button/style.css';
console.log(Button);
```

或者转换为：

```js
import Button from 'ant-design-vue/lib/button';
import 'ant-design-vue/lib/button/style.css';
console.log(Button);
```

# 安装

```sh
npm i babel-plugin-import-billd --save-dev
```

# 使用

babel.config.js：

- libraryName
- libraryDirectory
- style

> 这三个属性的具体行为基本和 [babel-plugin-import](https://github.com/umijs/babel-plugin-import#style) 一致

```js
plugins: [
  // ...
  [
    'import-billd',
    // Options在 babel@7+ 中不能是数组，但是可以添加带名字的插件来支持多个依赖。
    { libraryName: 'ant-design-vue', libraryDirectory: 'lib', style: 'css' },
    'aaa', // 这个名字可以随便起
  ],
  [
    'import-billd',
    { libraryName: 'antd', libraryDirectory: 'lib', style: true },
    'bbb',
  ],
],
```

# 测试

由于现代的组件库大多数都实现了原生的 ES modules 的 tree shaking，因此我们需要下载旧版的组件库才能测试出效果，这里我使用了 ant-design-vue 的 1.1.0 版本以及 antd 的 2.13.14 版本进行测试。

当遇到下面的代码时，会仅仅将 Button 和 Switch 进行打包：

```js
import { Button, Switch } from 'ant-design-vue';
console.log(Button, Switch);
```

# 参考

- [@babel/helper-module-imports](https://babel.dev/docs/en/babel-helper-module-imports)
- [babel-plugin-import](https://github.com/umijs/babel-plugin-import)
- [babel-handbook](https://github.com/jamiebuilds/babel-handbook/blob/master/translations/zh-Hans/plugin-handbook.md)
- [https://astexplorer.net](https://astexplorer.net)

# 源码

[https://github.com/galaxy-s10/babel-plugin-import-billd](https://github.com/galaxy-s10/babel-plugin-import-billd)
