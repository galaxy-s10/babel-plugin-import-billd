# 源码

[https://github.com/galaxy-s10/babel-plugin-import-billd](https://github.com/galaxy-s10/babel-plugin-import-billd)

# 概况

参考了[babel-plugin-import](https://github.com/umijs/babel-plugin-import)，实现了我认为核心的三个配置项：`libraryName`、`libraryDirectory`、`style`

# 安装

```sh
npm i babel-plugin-import-billd
```

# 使用

babel.config.js：

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
    { libraryName: 'antd', libraryDirectory: 'lib', style: 'css' },
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

# 引用

- [@babel/helper-module-imports](https://babel.dev/docs/en/babel-helper-module-imports)
- [babel-plugin-import](https://github.com/umijs/babel-plugin-import)
- [babel-handbook](https://github.com/jamiebuilds/babel-handbook/blob/master/translations/zh-Hans/plugin-handbook.md)
- [https://astexplorer.net](https://astexplorer.net)
