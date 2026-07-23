import * as React from "react";
import { cn } from "@/lib/utils";
import styles from "./AnimatedText.module.css";

const AnimatedText = React.forwardRef(function AnimatedText(
  {
    text,
    gradientColors = "linear-gradient(90deg, #ffffff 0%, #c8ccd4 40%, #8b919c 60%, #e8eaee 100%)",
    gradientAnimationDuration = 2.2,
    hoverEffect = false,
    className,
    textClassName,
    ...props
  },
  ref
) {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <div
      ref={ref}
      className={cn(styles.wrap, className)}
      {...props}
    >
      <h1
        className={cn(styles.title, textClassName)}
        style={{
          backgroundImage: gradientColors,
          animationDuration: `${gradientAnimationDuration}s`,
          filter: isHovered ? "drop-shadow(0 0 18px rgba(200, 205, 215, 0.45))" : undefined,
        }}
        onMouseEnter={() => hoverEffect && setIsHovered(true)}
        onMouseLeave={() => hoverEffect && setIsHovered(false)}
      >
        {text}
      </h1>
    </div>
  );
});

AnimatedText.displayName = "AnimatedText";

export { AnimatedText };
