<script setup lang="ts">
import { cva } from 'class-variance-authority'
import { cn } from '~/lib/utils'

const variants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        outline: 'border bg-transparent hover:bg-muted',
        ghost: 'hover:bg-muted',
        secondary: 'bg-muted hover:bg-muted/70'
      },
      size: { default: 'h-8 px-3', sm: 'h-7 px-2', icon: 'h-7 w-7' }
    },
    defaultVariants: { variant: 'default', size: 'default' }
  }
)
const props = defineProps<{ variant?: 'default' | 'outline' | 'ghost' | 'secondary', size?: 'default' | 'sm' | 'icon', class?: string }>()
</script>

<template>
  <button :class="cn(variants({ variant: props.variant, size: props.size }), props.class)">
    <slot />
  </button>
</template>
