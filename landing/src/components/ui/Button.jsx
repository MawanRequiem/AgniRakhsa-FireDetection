import { forwardRef } from 'react';

const variants = {
  primary: `
    bg-ifrit-red text-white
    hover:bg-ifrit-red-light
    active:bg-ifrit-red-dark
    focus-visible:ring-2 focus-visible:ring-ifrit-red focus-visible:ring-offset-2
  `,
  secondary: `
    bg-transparent border-2 border-current
    hover:bg-white/10
    active:bg-white/5
  `,
  ghost: `
    bg-transparent
    hover:bg-white/10
    active:bg-white/5
  `,
};

const sizes = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-3 text-base',
  lg: 'px-8 py-4 text-lg',
};

const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    as: Component = 'button',
    className = '',
    children,
    ...props
  },
  ref
) {
  return (
    <Component
      ref={ref}
      className={`
        inline-flex items-center justify-center gap-2
        font-display font-semibold tracking-tight
        rounded-[var(--radius-md)]
        transition-all duration-[var(--duration-fast)]
        ease-[var(--ease-out-quart)]
        cursor-pointer select-none
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]}
        ${sizes[size]}
        ${className}
      `.replace(/\s+/g, ' ').trim()}
      {...props}
    >
      {children}
    </Component>
  );
});

export default Button;
