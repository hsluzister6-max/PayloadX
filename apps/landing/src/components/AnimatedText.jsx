import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import styles from "./AnimatedText.module.css";

const AnimatedText = React.forwardRef(function AnimatedText(
  {
    text,
    gradientColors = "linear-gradient(90deg, #F6EFE8 0%, #E88C5A 40%, #C45C3A 60%, #F6EFE8 100%)",
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
      <motion.h1
        className={cn(styles.title, textClassName)}
        style={{
          backgroundImage: gradientColors,
          animationDuration: `${gradientAnimationDuration}s`,
          filter: isHovered ? "drop-shadow(0 0 18px rgba(232,140,90,0.45))" : undefined,
        }}
        onHoverStart={() => hoverEffect && setIsHovered(true)}
        onHoverEnd={() => hoverEffect && setIsHovered(false)}
        initial={{ opacity: 0, y: 12, letterSpacing: "0.12em" }}
        animate={{ opacity: 1, y: 0, letterSpacing: "-0.04em" }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        {text}
      </motion.h1>
    </div>
  );
});

AnimatedText.displayName = "AnimatedText";

export { AnimatedText };
