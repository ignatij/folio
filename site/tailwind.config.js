/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.njk", "./src/**/*.html", "./src/**/*.js"],
  safelist: [
    // Animation classes are built dynamically (animate-{{ anim }}) so static
    // scanning would silently strip them — safelist all animate-* variants.
    "animate-fade-in",
    "animate-slide-up",
    "animate-slide-down",
    "animate-slide-left",
    "animate-slide-right",
    "animate-scale-in",
    "animate-scale-out",
    "animate-blur-in",
    // Image height classes set via inspector (dynamic, not in templates)
    "h-auto",
    "h-32",
    "h-48",
    "h-64",
    "h-80",
    "h-96",
    "h-screen",
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
