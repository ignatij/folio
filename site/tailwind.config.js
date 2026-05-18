/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.njk", "./src/**/*.html", "./src/**/*.js"],
  safelist: [
    // Animation classes built dynamically (animate-{{ anim }})
    { pattern: /^animate-/ },
    // Height/width classes set dynamically via inspector
    { pattern: /^(h|w|max-w|min-w|max-h|min-h)-/ },
    // Spacing set dynamically via inspector
    { pattern: /^(p|m|gap|pt|pb|pl|pr|mt|mb|ml|mr|px|py|mx|my|gap-x|gap-y)-/ },
    // Flex/grid layout (with responsive variants for dynamic md:grid-cols-N in templates)
    {
      pattern: /^(flex|grid|justify|items|self|order|col|row)-/,
      variants: ["sm", "md", "lg", "xl"],
    },
    // Typography set dynamically
    { pattern: /^(text|font|leading|tracking|prose)/ },
    // Rounded set dynamically
    { pattern: /^rounded/ },
  ],
  theme: {
    extend: {
      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { transform: "translateY(40px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        slideDown: {
          from: { transform: "translateY(-40px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        slideLeft: {
          from: { transform: "translateX(40px)", opacity: "0" },
          to: { transform: "translateX(0)", opacity: "1" },
        },
        slideRight: {
          from: { transform: "translateX(-40px)", opacity: "0" },
          to: { transform: "translateX(0)", opacity: "1" },
        },
        scaleIn: {
          from: { transform: "scale(0.85)", opacity: "0" },
          to: { transform: "scale(1)", opacity: "1" },
        },
        scaleOut: {
          from: { transform: "scale(1.15)", opacity: "0" },
          to: { transform: "scale(1)", opacity: "1" },
        },
        blurIn: {
          from: { filter: "blur(8px)", opacity: "0" },
          to: { filter: "blur(0)", opacity: "1" },
        },
      },
      animation: {
        "fade-in":
          "fadeIn    var(--anim-duration, 600ms) var(--anim-easing, ease-out) var(--anim-delay, 0ms) both",
        "slide-up":
          "slideUp   var(--anim-duration, 600ms) var(--anim-easing, ease-out) var(--anim-delay, 0ms) both",
        "slide-down":
          "slideDown var(--anim-duration, 600ms) var(--anim-easing, ease-out) var(--anim-delay, 0ms) both",
        "slide-left":
          "slideLeft var(--anim-duration, 600ms) var(--anim-easing, ease-out) var(--anim-delay, 0ms) both",
        "slide-right":
          "slideRight var(--anim-duration, 600ms) var(--anim-easing, ease-out) var(--anim-delay, 0ms) both",
        "scale-in":
          "scaleIn   var(--anim-duration, 600ms) var(--anim-easing, ease-out) var(--anim-delay, 0ms) both",
        "scale-out":
          "scaleOut  var(--anim-duration, 600ms) var(--anim-easing, ease-out) var(--anim-delay, 0ms) both",
        "blur-in":
          "blurIn    var(--anim-duration, 600ms) var(--anim-easing, ease-out) var(--anim-delay, 0ms) both",
      },
    },
  },
  plugins: [],
};
