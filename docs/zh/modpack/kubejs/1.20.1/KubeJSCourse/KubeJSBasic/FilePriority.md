---
authors:
  - Gu-meng
editor: Gu-meng
---
# 文件优先级
代码执行是从上至下，文件加载默认是从a到z

在kubejs当中我们是可以直接跨文件调用方法参数等内容的，但是大前提是这个文件是加载游戏级高的

这里注意一下，这里的跨文件但是不难跨端，比如你无法在`startup`里调用`server`里的方法，如果真的需要可以看[global全局变量](../KubeJSAdvanced/GlobalVariable.md)

kubejs提供了一个注释来标注文件的优先级 `// priority: 10`

在文件的开头也就是第一行写上这个注释并标注优先等级

优先等级为冒号后面的数字

如果等级越高则越先加载，等级越低则在后面加载

没有等级的将会按照文件名a~z加载
