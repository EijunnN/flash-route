interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  ref?: React.Ref<HTMLDivElement>;
}

function ScrollArea({ className, children, ref, ...props }: ScrollAreaProps) {
  return (
    <div ref={ref} className={`overflow-auto ${className || ""}`} {...props}>
      {children}
    </div>
  );
}

export { ScrollArea };
