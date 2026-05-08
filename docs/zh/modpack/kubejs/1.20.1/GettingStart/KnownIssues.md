---
title: 已知限制与兼容性问题
description: 基于文档与源码整理的 KubeJS 1.20.1 使用边界
priority: 70
layout: doc
---

# KubeJS 1.20.1 的限制与问题 {#Introduction}

`1.20.1` 的 KubeJS 能实现许多逻辑，但它既没有完整的现代 JavaScript 框架，也被人为规定了许多限制。很多看起来像“脚本写错了”的问题，实际是其限制与问题所导致的。

:::: alert {"type":"info","title":"注意","variant":"outlined","border":"start"}
本页用于让你在遇到某些难以判断的错误时，可以供你判断“它是不是 KubeJS 1.20.1 的引擎、行为规范或语法支持度的限制”。
::::

## 查阅顺序 {#LookupOrder}

::: steps
@tab 先确认归属

先判断问题更像语法不能解析、类无法加载、参数解析异常，还是某个事件或功能本身没有效果。

@tab 再对照本页的对应条目

`Java.loadClass(...)` 先看 `class filter`；`candidate methods` 先看重载歧义；`number` 异常先看 `TypeWrapper`；世界生成完全无效先看 `WorldgenEvents.add()`。

@tab 最后回到具体环境

本页描述的是原生 KubeJS 1.20.1 的默认能力。如果整合包额外引入 `ClassJS`、`Kubeloader` 或其他附属模组，应结合它们的行为重新判断。
:::

## 常见表现 {#QuickIndex}

| 表现 | 优先检查的方向 |
| :--- | :--- |
| `Java.loadClass(...)` 报错，或 `Java.tryLoadClass(...)` 返回 `null` | 类不存在，或被 `class filter` 拦截 |
| `class Foo {}`、默认参数、`...args` 等语法不能正常使用 | 当前 Rhino 语法边界 |
| 日志里出现 `redeclaration of const`，或反复遇到 `duplicate const` 一类问题 | 尽量避免把 `const` 当成起步阶段的默认写法 |
| 某个参数明明传了 `number`，结果行为仍然异常，或者某个需要int的参数传入init，却仍旧显示传入了 `number`的错误 | `TypeWrapper` 转换 |
| 日志里出现 `candidate methods` 或 `candidate constructors` | Java 方法或构造函数的重载歧义 |
| 传一个 JS 函数给 Java 接口时直接报错 | 接口适配限制 |
| `persistentData` 的行为与 Forge / NeoForge 的认知不一致 | KubeJS 自己的数据处理和 Loader 的不同 |
| `EntityEvents.hurt` 里能读到伤害值，但改动无效并报错 | `1.20.1` 中这一事件只提供只读伤害值 |
| 世界生成脚本完全没有效果 | `WorldgenEvents.add()` 在 `1.20.1` 尚未支持 |

## 文档与源码可直接对应的限制 {#SourceBackedLimits}

### 类加载与语法边界 {#RuntimeBoundaryGroup}

:::: alert {"type":"warning","title":"","variant":"tonal"}
如果类根本无法加载，或语法本身不能被 Rhino 理解或接受，那更多的讨论都没有意义。
::::

### `Java.loadClass(...)` 会受到 `class filter` 限制 {#ClassFilter}

这里的 `class filter`，可以理解为一套“哪些 Java 类允许暴露给脚本”的过滤规则。`Java.loadClass(...)` 失败，并不只表示类名写错。

`ScriptManager.loadJavaClass(...)` 在加载类时会先检查该类是否允许暴露给脚本：

```java
if (!isClassAllowed(name)) {
    either = Either.right(true);
}

throw Context.reportRuntimeError(
    (found ? "Failed to load Java class '%s': Class is not allowed by class filter!"
           : "Failed to load Java class '%s': Class could not be found!")
        .formatted(name),
    context
);
```

过滤器本身也有独立实现：

```java
if (denyStrong.contains(s)) {
    return V_DENY;
}

if (allowStrong.contains(s)) {
    return V_ALLOW;
}
```

因此，`Java.tryLoadClass(...)` 返回 `null` 时，至少有两种不同原因：

- 该类确实不存在。
- 该类存在，但被 `class filter` 拒绝。

排查时不应只反复修改包名。

### 当前语法环境不能按完整现代 JavaScript 理解 {#RhinoBoundary}

原生 KubeJS 使用的是定制 Rhino。它支持一部分较新的语法特性，但不能按浏览器或 Node.js 的完整现代 JavaScript 能力来预设行为。对起步阶段来说，更直接的理解是：不要把现代 JavaScript 语法默认视为全部可用。

*[原生]: KubeLoader会将引擎更换为GraalJS

#### `class` 语法不可用，但 ES5 构造函数可用 {#ClassSyntaxBoundary}

在原生 `1.20.1` 中，脚本侧的 `class` 语法不应作为默认可用前提。例如：

```js
class Foo {}
```

Rhino 的 token 常量里把 `class` 归到了 `RESERVED`：

```text
public static final int RESERVED;
ConstantValue: int 128
```

`TokenStream` 对 `class` 关键字也会落到这一分支：

```text
839: aload_2
840: ldc           #139                // String class
...
1396: sipush        128
```

这段源码说明的是：`class` 在当前运行时不可以直接按现代 JavaScript 引擎使用的语法去理解与使用。

但这并不影响 ES5 风格的构造函数写法。例如：

```js
function Foo(name) {
    this.name = name;
}

const foo = new Foo("example");
```

这类 `function + new` 的构造方式，与 `class Foo {}` 不是同一套语法，因此应分开理解。

#### 默认参数与 `...args` 不可用 {#FunctionSyntaxBoundary}

对于函数语法，也不要把默认参数和 rest 参数当成 KubeJS 原生支持的特性。

此处需要谨记的是：

- 默认参数不能按现代 JavaScript 的写法使用。
- `...args` 这类 rest 参数也不能按现代 JavaScript 写法使用。

如果你不知道这两种特性对应的是什么：

```js
function x(arg = 1) {}
function y(...args) {}
```

如果脚本需要兼容这一环境，应改写成 ES5 风格的参数处理方式，而不能沿用浏览器或 Node.js 中常见的现代写法。

#### 尽量不要使用 `const` {#ConstRedeclare}

你可以注意到很多教程包括本文档都使用了 `const` 来定义常量，所以此处要说的并非是const本身无法使用，而是其存在一个很常见、也很烦人的问题。

Rhino 的报错文本里本身就有这一条：

```text
msg.const.redecl=
    TypeError: redeclaration of const {0}.
```

实际写脚本时，`const` 有时会触发你并不预期的重复声明报错，尤其是涉及函数的循环时，所以一般来说用 `let` 会更稳妥。真遇到 `redeclaration of const`、`duplicate const` 这类错误时，优先先把相关声明改成 `let` 或再继续排查。

但不必因为这个问题而过于敏感，不涉及函数循环时可以顺着直觉先使用 `const` 定义常量。

### Java类 操作与参数解析 {#InteropBoundaryGroup}

:::: alert {"type":"info","title":"这一组问题的共性","variant":"outlined","border":"start"}
很多“明明有这个方法，为什么还是报错”的问题，实质上发生在 JS 值到 Java 参数的映射过程中。
::::

### `class`、ES5 构造函数、继承与 Java 类不是同一件事 {#ClassAndExtends}

KubeJS内无法继承（extends）类，无法实现（implements）接口。

这条限制说的是“不能在脚本里按 Java 的继承 / 实现模型继续写下去”，并不等于“不能使用已经拿到的 Java 类”。

如果某个类能够被 `Java.loadClass(...)` 成功加载，通常仍然可以：

- 访问它的静态字段与静态方法。
- 使用 `new` 调用它的构造函数。

例如：

```js
new $AABB(0, 0, 0, 1, 1, 1);

new (Java.loadClass("net.minecraft.world.entity.ExperienceOrb"))(
    level,
    x,
    y,
    z,
    10,
);
```

因此，“不能 `class`”不应被误解为下面任意一种情况：

- 不能使用 ES5 风格的构造函数。
- 不能 `new` 已成功加载的 Java 类。

但这不等于“可以在 `new` 的同时顺手定义子类并覆写方法”。

像“先 `new` 一个 Java 类，再在构造时附带覆写体”的思路，本质上仍然是在脚本侧创建匿名子类并重写方法，而不是普通的构造函数调用；因此同样不支持。换句话说：

- `new 已成功加载的 Java 类(...)` 这种普通实例化可以成立。
- `new 已成功加载的 Java 类(...)` 后再附带覆写逻辑，这类匿名子类 / override 思路不支持。

很多人会误以为下面这种写法等于“先创建对象，再覆写 Java 方法”：

```js
const ExperienceOrb = Java.loadClass("net.minecraft.world.entity.ExperienceOrb");

const orb = new ExperienceOrb(level, x, y, z, 10); // [!code ++]

orb.tick = function () { // [!code error]
    console.info("custom tick"); // [!code error]
}; // [!code error]
```

但这不会生成一个覆写了 `tick()` 的 Java 子类。它只是试图在脚本侧给这个对象挂一个同名属性，而不是按 Java 的方式重写原方法，且会直接报错。

真正受限的是脚本侧的 `class` 语法，以及 Java 风格的 `extends / implements`；==而“构造时直接 override” 本质上也属于同一类限制==。

### 单个 JS 函数只适合少数回调接口 {#InterfaceAdapter}

这里说的不是“把函数传给任何 Java 参数都行”，而是 Rhino 会在少数情况下，把一个 JS 函数临时适配成一个 Java 接口实例。

示意写法如下：

```js
someJavaApi(function (value) {
    return value > 0;
});
```

这类写法成立的前提，是 `someJavaApi` 对应的那个参数，本来就要求一个“回调型接口”。这里先把它理解成：**Java 侧等的，本来就是一个回调位。**

`InterfaceAdapter.create(...)` 里的判断可以把边界说明得更清楚：

```java
if (methods.length == 0) {
    throw Context.reportRuntimeError1("msg.no.empty.interface.conversion", ...);
}

if (!firstName.equals(method.getName())) {
    throw Context.reportRuntimeError1("msg.no.function.interface.conversion", ...);
}
```

对应的消息文本是：

```properties
msg.no.function.interface.conversion=
    Cannot convert function to interface {0} since it contains methods with different names
```

:::: alert {"type":"info","title":"这一节目前在理论阶段","variant":"outlined","border":"start"}
这里的结论目前主要来自 `InterfaceAdapter` 的源码，还没有把所有相关接口形态都在 KubeJS 环境里做实测和分析可以衍生出的用法。因此，这一节更适合被视作说明，而不是结论。
::::

按这段逻辑，可以确定以下规则：

- 接口没有方法时，不能把 JS 函数转换进去。
- 接口里有多个不同名字的方法时，不能把 JS 函数转换进去。
- 只有当接口里需要适配的方法都叫同一个名字时，Rhino 才会继续尝试转换。

对初学者来说，更好记的说法是：**单个 JS 函数只适合那种“Java 侧本来就在等一个回调”的接口。**

所以，文档里说“这类写法可能成立”，指的其实就是下面这类情况：

- Java 参数本来就是回调接口。
- 这个接口通常只有一个需要实现的方法。
- 少数情况下，即使有多个签名，只要方法名相同，Rhino 也可能继续尝试适配，但这一点目前仍缺少源码外的独立实测确认。

相反，下面这些情况不属于这条路：

- 空接口。
- 有多个不同方法名的接口。
- 把函数赋给一个已经存在的 Java 对象，指望它变成方法覆写。

这一点在 `ItemEvents.modification` 里尤其容易误判，因为这里拿到的 `item` 不是“等待你实现的接口参数”，而是“已经创建好的 Java 对象”。

很多人在看到 `item` 是一个 Java 物品对象后，会自然地写出类似下面这种代码，试图直接覆写某个 Java 方法：

```js
ItemEvents.modification((event) => {
    event.modify("minecraft:apple", (item) => {
        item.someMethod = () => {
            return 1;
        };
    });
});
```

这类写法不可行。原因不是箭头函数本身特殊，而是这里真正想做的事情，其实是“在脚本里直接覆写一个 Java 方法”。`ItemEvents.modification` 给你的，是一个已经存在的 Java 对象；KubeJS 不会因为你写了 `item.someMethod = ...`，就替你生成新的 Java 子类，也不会把这段函数自动变成一次合法的方法覆写。如果确实需要定制这类底层行为，通常需要转向 KubeJS Addon 层面的实现。

这里要分清两件事：

- 修改 KubeJS 已经暴露出来、允许改动的字段或属性。
- 直接覆写原有 Java 方法。

前者在 `ItemEvents.modification` 中经常可以做到；后者通常做不到。即使把箭头函数换成 `function () {}`，结论也不会改变。

### 高频问题 `number` 与 `TypeWrapper` {#NumberAndTypeWrappers}

`number` 在 KubeJS 里是高频问题，而且最麻烦的地方往往不是“值不对”，而是 Rhino 在挑 Java 方法时，并不会先把它当成明确的 `int`、`float` 或 `double`。

从 Rhino 的调用顺序看，这个问题要分成前后两步：

- `NativeJavaMethod.call()` 会先调用 `findCachedFunction()` / `findFunction()` 去决定选哪一个重载。
- 真正的参数转换在后面才发生，也就是 `Context.jsToJava()` 再进入 `NativeJavaObject.coerceTypeImpl()`。

这意味着，像 `parseInt(...)`、`Math.floor(...)`，甚至 `Utils.parseInt(...)` 这类先做一次整数化的处理，很多时候也只能改数值内容，改不了 Rhino 在挑方法时看到的参数种类。它们回到下一次 Java 调用里时，往往仍然只是一个普通的 `number`。

Rhino 在前面这一步里，会把数值统一看成 `number`。例如：

- `NativeJavaMethod.scriptSignature()` 对 `Number` 会直接写出 `number`。
- `NativeJavaObject.getJSTypeCode()` 对 `Number` 也统一归到 `JSTYPE_NUMBER`。

真正把参数收窄成 `int`、`float`、`long` 的逻辑，是后面 `coerceTypeImpl()` 里的 `coerceToNumber()`。例如目标类型是 `Integer.TYPE` 时，它才会继续走 `toInteger(...)` 这条分支。

因此，最常见也最棘手的情况其实是：

- 你传进去的明明是要给 `int` 用的值。
- 但在 Rhino 选重载的那一步，它仍然只是一个泛化的 `number`。
- 如果这个 API 同时还有 `float`、`double`、`long`、包装类型，或其他相近签名，就很容易直接落到 `candidate methods`、歧义选择，甚至方法匹配失败。

这也解释了为什么“先转成整数再传”经常没有预期效果。问题不在 Rhino 完全不会转 `int`，而在于它通常要等到方法已经选定之后，才真正去做这一步；如果前面的重载选择已经出错，后面的 `intValue()` 根本没有机会救场。

在这之后，`TypeWrapper` 才是第二层复杂因素。KubeJS 确实注册了多种 wrapper：

```java
typeWrappers.registerSimple(IntProvider.class, UtilsJS::intProviderOf);
typeWrappers.registerSimple(NumberProvider.class, UtilsJS::numberProviderOf);
typeWrappers.registerSimple(TemporalAmount.class, UtilsJS::getTemporalAmount);
```

这表示当目标参数不是普通 `int` / `float`，而是 `IntProvider`、`NumberProvider` 这一类时，`number` 还会再被 KubeJS 额外改写一次：

```java
public static IntProvider intProviderOf(Object o) {
    if (o instanceof Number n) {
        return ConstantInt.m_146483_(n.intValue());
    }
    ...
    return ConstantInt.m_146483_(0);
}

public static NumberProvider numberProviderOf(Object o) {
    if (o instanceof Number n) {
        var f = n.floatValue();
        return UniformGenerator.m_165780_(f, f);
    }
    ...
    return ConstantValue.m_165692_(0);
}
```

所以，`number` 相关问题更准确的判断顺序应当是：

- 这个 API 需要的是普通 Java 数值参数，还是别的数值相关类型。
- Rhino 在挑方法时，是否会把几个重载都当成“同样接收 `number`”。
- 目标参数是否还会触发 `TypeWrapper`，把值继续改写成 `IntProvider`、`NumberProvider` 之类的对象。

这一类问题目前仍然没有稳定的通用解法。显式签名调用、改写参数结构、换更明确的 API，这些都值得尝试；但如果根因出在 Rhino 先按 `number` 选重载，再按 `int`/`float` 转值，那么单纯“先转一下整数再传”往往并不够。

真要处理时，通常只剩下几种更实际的办法：

- 如果问题出在重载，优先用显式签名调用，例如 `object["method(int)"](value)`、`object["method(float)"](value)`。这一步最直接，因为它绕过了 Rhino 前面的重载猜测。
- 如果 ProbeJS 已经给出了带引号的重载签名，优先照那个签名写，而不要继续让 Rhino 自己猜。
- 如果这个 API 本来就有多个数值重载，而且你会反复调用它，最稳妥的办法通常不是继续在脚本里“转类型”，而是包一层只有单一签名的辅助方法，再让 KubeJS 去调用那个辅助方法。
- 如果目标参数其实不是普通 `int` / `float`，而是 `IntProvider`、`NumberProvider` 之类的类型，就不要再按“普通数字参数”去调，应该直接改用该类型对应的输入形式。

至少按目前这一套实现来看，纯脚本层面并没有一个稳定的“强制把这个值变成 Java int 并提前参与重载选择”的通用手段。这也是为什么 `parseInt(...)`、`Utils.parseInt(...)` 一类写法经常仍然不够。

### 出现 `candidate methods` 时，应先检查重载歧义 {#OverloadAndCandidates}

Java 的“重载”，是指同一个方法名对应多组不同参数。Rhino 无法判断该选哪一组时，会直接抛出歧义错误。

源码里的报错文本如下：

```properties
msg.method.ambiguous=
    The choice of Java method {0}.{1} matching JavaScript argument types ({2}) is ambiguous; candidate methods are: {3}

msg.constructor.ambiguous=
    The choice of Java constructor {0} matching JavaScript argument types ({1}) is ambiguous; candidate constructors are: {2}
```

因此，日志里出现 `candidate methods` 或 `candidate constructors` 时，优先怀疑的是“同名方法或构造函数太多，Rhino 不知道该选哪一个”。

这时应先尝试显式签名调用：

```text
object["方法名(完整参数类型)"](args)
```

ProbeJS 文档里给过一个直接例子：

```text
event.hand["compareTo(net.minecraft.world.InteractionHand)"](arg)
```

这类写法的作用，是把完整签名直接告诉 Rhino，避免它继续猜测。

需要注意两点：

- 这一步主要解决“重载歧义”。
- 它不是万金油。如果真正的问题是 `TypeWrapper`、参数值本身不对，或 API 本来就不接受当前参数，它仍然可能失败。

构造函数也适用同样的判断逻辑。若日志里出现 `candidate constructors`，应把它视为与方法重载同类的问题。

### KubeJS 的版本行为和自定义的持久化数据 {#BehaviorBoundaryGroup}

:::: alert {"type":"warning","title":"名称映射会影响判断","variant":"tonal"}
KubeJS 有大量 `RemapForJS` 命名映射。比如实体源码里的 `setDeltaMovement(...)`，在脚本侧会变成 `setMotion(...)`，所以看到熟悉名词时，不能直接按 Minecraft / Forge / NeoForge 原名理解。

持久化数据存在同类问题。在这里十分让人困惑的是：许多原生方法会被改成更贴近脚本习惯的名字，而 KubeJS 自己维护的持久化数据却使用了容易与 Forge 混淆的 `persistentData`；同时，Forge 实体原本的 `getPersistentData()` 又被重新映射成别的名字。因此，判断时必须看它最后接的是哪套实现，不能只看名称；某些事件在 `1.20.1` 里也只提供部分能力。
::::

### `persistentData` 不是 Forge / NeoForge 的持久化附件 {#PersistentData}

仓库文档已经说明，`persistentData` 是 KubeJS 提供的自定义数据存储系统，**不是 NBT 数据，也不是 Forge / NeoForge 的附件体系**。

这里之所以容易让人看混，一个原因就是 KubeJS 里大量 API 名称都不是直接照搬 Minecraft / Forge 原名，而是经过了脚本侧重命名。实体相关源码里就能直接看到：

```java
@RemapForJS("setMotion")
public abstract void setDeltaMovement(double x, double y, double z);
```

Forge 侧实体原本的 `getPersistentData()`，在脚本里也没有直接保留原名，而是另外映射成了：

```java
@RemapForJS("getForgePersistentData")
public abstract CompoundTag getPersistentData();
```

因此，这一节里的 `persistentData` 指的是 KubeJS 自己维护的那一套，不应和 Forge 的同名概念混为一谈。

如需对照 Loader 原生机制，可参考 Forge 官方的 [Capabilities](https://docs.minecraftforge.net/en/1.20.x/datastorage/capabilities/) 与 [Saved Data](https://docs.minecraftforge.net/en/1.20.x/datastorage/saveddata/)，以及 NeoForge 官方的 [Data Attachments](https://docs.neoforged.net/docs/1.20.6/datastorage/attachments/) 与 [Saved Data](https://docs.neoforged.net/docs/1.20.6/datastorage/saveddata/)。Forge 文档把能力系统放在 `BlockEntity`、`Entity`、`ItemStack`、`Level`、`LevelChunk` 上；NeoForge 文档则把额外数据拆成 `block entities`、`chunks`、`entities` 的 Data Attachments 与 `level` 的 Saved Data。NeoForge 公开文档没有 `1.20.1` 分支，这里引用的是最接近的 `1.20.5 - 1.20.6` 页面。

按 `WithPersistentData` 的实现与 mixin 范围来看，原生 KubeJS 1.20.1 里这套 `persistentData` 主要支持下面几类对象：

- `MinecraftServer`
- `ServerLevel`
- `Entity`

实际使用时还可以再顺手记两点：

- 玩家属于 `Entity`，所以玩家也在这一组里。
- 维度数据对应的是 `ServerLevel`，不是泛用的 `Level`。

源码中也可以看到，KubeJS 自己维护了独立字段。以实体为例：

```java
private CompoundTag kjs$persistentData;

if (kjs$persistentData != null && !kjs$persistentData.m_128456_()) {
    tag.m_128365_("KubeJSPersistentData", kjs$persistentData);
}
```

服务器对象上也有独立字段：

```java
@Unique
private final CompoundTag kjs$persistentData = new CompoundTag();
```

而 `ServerLevel` 这边的实现也说明了，维度数据会按维度 id 挂到服务器这份数据下面：

```java
var t = kjs$self().m_46472_().m_135782_().toString();
kjs$persistentData = kjs$self().m_7654_().kjs$getPersistentData().m_128469_(t);
kjs$self().m_7654_().kjs$getPersistentData().m_128365_(t, kjs$persistentData);
```

因此，更准确的理解是：`persistentData` 是 KubeJS 提供的一套持久化数据，它会写入存档，但其语义不应直接按 Forge / NeoForge 的持久化机制去套。

### `EntityEvents.hurt` 在 `1.20.1` 中只能读不能改 {#HurtReadonly}

`LivingEntityHurtEventJS` 提供的伤害值是只读字段：

```java
private final float amount;

@Info("The amount of damage.")
public float getDamage() {
    return amount;
}
```

这里只有 `getDamage()`，没有对应的 setter。因此，在 `EntityEvents.hurt` 中能读到伤害值，并不表示它也能直接改写伤害。1.21.1 的 KubeJS 7 已优化此问题。

如果目的是改伤害，而不是只读取伤害，那么在 `1.20.1` 里应改用 Forge 事件总线上的 `LivingHurtEvent`。Forge 源码里这个事件本身提供了 `setAmount(float)`：

```java
public float getAmount() { return amount; }

public void setAmount(float amount) { this.amount = amount; }
```

如果只是不熟悉 Forge 事件总线本身，可以先对照 Forge 官方的 [Events](https://docs.minecraftforge.net/en/1.20.x/concepts/events/) 页面。

最小示例是：

```js
// startup_scripts/example_hurt.js
ForgeEvents.onEvent("net.minecraftforge.event.entity.living.LivingHurtEvent", event => {
    /**
     * @type {Internal.livingHurtEvent} // [!code ++] ForgeEvents如果不标注类型的话会没有正常补全。
     */
    const livingHurtEvent = event;
    livingHurtEvent.setAmount(livingHurtEvent.getAmount() * 0.5);
});
```

这里只做简单示例。进阶内容留到以后。

### `WorldgenEvents.add()` 在 `1.20.1` 中本身就未完成 {#WorldgenUnsupported}

这一条可以直接在 `AddWorldgenEventJS` 中看到：

```java
ConsoleJS.STARTUP.error(
    "WorldgenEvents.add() is currently not supported in 1.20 yet! This will be fixed soon, but for now we recommend you comment out worldgen code. Sorry for inconvenience!"
);
```

而且 `addOre(...)`、`addLake(...)` 等方法在这一版本里会直接 `return`。如果世界生成脚本在 `1.20.1` 完全没有效果，应先排除这一限制。

### `Math` 常量有时会是 `undefined` {#MathConstantsUndefined}

`NativeMath` 初始化时会是 `findPrototypeId` 把方法和常量的内部 ID 都放入 `prototypeValues`，但 `findPrototypeId` 只加了方法没加常量：

```java
if (method.m_146815_().equals(name)) {
    return method.m_146812_();
}
```

而常量初始化走的是另一条路，所以永远无法被找到。如果遇到 `Math.PI`、`Math.E` 等结果是 `undefined`，应使用 `KMath` 代替。!!听起来很奇怪对吧但这是真的!!

## 兼容性提醒 {#ExperienceNotes}

:::: alert {"type":"info","title":"这一节的定位","variant":"outlined","border":"start"}
下面几项来自社区反馈，在实际编写中很常见，但不像前文那样都有单一、直接的源码可以作证，可能有着编写环境问题。使用时应结合整合包、附属模组与运行环境。
::::

### `Proxy` 不可用 {#Proxy}

在原生 KubeJS 1.20.1 中，无法使用 `Proxy`。你的设计不应依赖代理拦截、动态转发或类似能力，再去确认附属模组与额外运行时是否真的提供了这部分支持。

### ProbeJS 补全不等于运行时对象本身 {#ProbeJsBoundary}

ProbeJS 很有用，但它给出的补全常为实例的父类。补全里没有某个方法不等于运行时一定没有；补全里能看到某个签名，也不等于当前参数一定能通过 Rhino 的转换与重载解析。

因此，补全只能帮助你缩小范围，不能替代日志、JSDoc、源码阅读和实际测试。!!还有看这篇文章。!!

### 附属模组会改变本页的前提 {#ExtensionBoundary}

如果整合包额外引入了 `ClassJS`、`Kubeloader` 或其他会扩展 Rhino / KubeJS 能力的附属模组，那么本页的很多结论都需要重新判断。它们改变的是运行时边界，而不是原生 KubeJS 1.20.1 本体的默认能力。
