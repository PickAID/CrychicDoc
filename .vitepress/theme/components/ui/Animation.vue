<!-- .vitepress/theme/Layout.vue -->

<script setup lang="ts">
    import { useData } from "vitepress";
    import DefaultTheme from "vitepress/theme";
    import { nextTick, provide, h, onMounted, ref } from "vue";

    const { Layout } = DefaultTheme;
    const { isDark } = useData();
    const isClient = ref(false);

    // Check if browser supports view transitions
    const enableTransitions = () => {
        if (!isClient.value || typeof document === 'undefined' || typeof window === 'undefined') return false;
        return (
            "startViewTransition" in document &&
            window.matchMedia("(prefers-reduced-motion: no-preference)").matches
        );
    };

    onMounted(() => {
        isClient.value = true;
    });

    provide(
        "toggle-appearance",
        async ({ clientX: x, clientY: y }: MouseEvent) => {
            if (!enableTransitions()) {
                isDark.value = !isDark.value;
                return;
            }

            const clipPath = [
                `circle(0px at ${x * 1.26}px ${y + 25}px)`,
                `circle(${Math.hypot(
                    Math.max(x, innerWidth - x),
                    Math.max(y, innerHeight - y)
                )}px at ${x}px ${y}px)`,
            ];

            await document.startViewTransition(async () => {
                isDark.value = !isDark.value;
                await nextTick();
            }).ready;

            document.documentElement.animate(
                { clipPath: isDark.value ? clipPath.reverse() : clipPath },
                {
                    duration: 300,
                    easing: "ease-in",
                    pseudoElement: `::view-transition-${
                        isDark.value ? "old" : "new"
                    }(root)`,
                }
            );
        }
    );
</script>

<template>
    <slot name="slot"></slot>
</template>

<style>
    ::view-transition-old(root),
    ::view-transition-new(root) {
        animation: none;
        mix-blend-mode: normal;
    }

    ::view-transition-old(root),
    .dark::view-transition-new(root) {
        z-index: 1;
    }

    ::view-transition-new(root),
    .dark::view-transition-old(root) {
        z-index: 9999;
    }

    /* .VPSwitchAppearance {
  width: 22px !important;
}

.VPSwitchAppearance .check {
  transform: none !important;
} */
</style>
