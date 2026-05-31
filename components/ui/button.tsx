'use client'
import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/bertos/cn'

const buttonVariants = cva(
  'olympus-live-control inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(212,180,131,0.40)] disabled:pointer-events-none disabled:opacity-40 select-none',
  {
    variants: {
      variant: {
        default:
          'border border-[rgba(212,180,131,0.35)] bg-[rgba(212,180,131,0.12)] text-[#D4B483] hover:bg-[rgba(212,180,131,0.20)] hover:border-[rgba(212,180,131,0.50)] active:scale-[0.98] shadow-[0_0_18px_rgba(212,180,131,0.12)]',
        secondary:
          'bg-[rgba(30,24,16,0.80)] text-[#C8B080] hover:bg-[rgba(40,32,20,0.90)] border border-[rgba(212,180,131,0.18)]',
        ghost:
          'text-[#6A5A3A] hover:text-[#D4B483] hover:bg-[rgba(212,180,131,0.06)]',
        destructive:
          'bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-600/20',
        outline:
          'border border-[rgba(212,180,131,0.22)] text-[#9A8060] hover:bg-[rgba(212,180,131,0.06)] hover:text-[#D4B483]',
        glow:
          'bg-[rgba(212,180,131,0.15)] text-[#F0E8D0] hover:bg-[rgba(212,180,131,0.22)] border border-[rgba(212,180,131,0.40)] shadow-[0_0_28px_rgba(212,180,131,0.25)]',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-7 px-3 text-xs',
        lg: 'h-11 px-6 text-base',
        icon: 'h-9 w-9',
        'icon-sm': 'h-7 w-7',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'

    if (asChild) {
      return (
        <Comp
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          {...props}
        >
          {children}
        </Comp>
      )
    }

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      >
        <span className="olympus-button-gyro" aria-hidden="true">
          <span className="olympus-button-gyro__ring" />
          <span className="olympus-button-gyro__cube" />
          <span className="olympus-button-gyro__wing" />
        </span>
        <span className="olympus-button-content">{children}</span>
      </Comp>
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
