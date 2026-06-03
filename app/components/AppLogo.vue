<template>
  <div class="flex items-center gap-2.5 font-sans select-none group/logo">
    <!-- Premium High-Fidelity Transform Logo -->
    <div class="relative flex items-center justify-center w-9 h-9 rounded-xl bg-neutral-100/60 dark:bg-neutral-900/40 border border-neutral-200/50 dark:border-neutral-800/40 group-hover/logo:border-primary-500/30 group-hover/logo:bg-primary-500/5 transition-all duration-300 shadow-sm overflow-hidden shrink-0">
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        class="text-neutral-700 dark:text-neutral-300 group-hover/logo:text-primary-500 transition-colors duration-300"
      >
        <!-- The Left Page/Source Layer -->
        <path
          d="M3 5.5C3 4.67157 3.67157 4 4.5 4H14.5L19 8.5V19.5C19 20.3284 18.3284 21 17.5 21H4.5C3.67157 21 3 20.3284 3 19.5V5.5Z"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linejoin="round"
          class="opacity-60 group-hover/logo:opacity-30 transition-opacity duration-300"
        />

        <!-- The Page Fold Corner -->
        <path
          d="M14 4V8.5H18.5"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linejoin="round"
          class="opacity-60 group-hover/logo:opacity-30 transition-opacity duration-300"
        />

        <!-- Transforming Markdown Inner Sheet (The Green Markdown layer that slides forward) -->
        <path
          d="M8.5 9H13.5M8.5 13H15.5M8.5 17H12"
          stroke="var(--ui-primary)"
          stroke-width="2"
          stroke-linecap="round"
          class="translate-x-[-1px] group-hover/logo:translate-x-0.5 transition-transform duration-300"
        />

        <!-- Quick Downward Action Arrow representing active conversion -->
        <path
          d="M16 14.5V18.5M16 18.5L14 16.5M16 18.5L18 16.5"
          stroke="var(--ui-primary)"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="translate-y-[-1px] group-hover/logo:translate-y-0.5 transition-transform duration-300"
        />
      </svg>
      <!-- Tiny ambient glow background inside logo frame -->
      <div class="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--ui-primary)_0%,transparent_70%)] opacity-0 group-hover/logo:opacity-10 transition-opacity duration-300" />
    </div>

    <!-- Text Branding -->
    <span class="text-lg font-black tracking-tight text-neutral-900 dark:text-white font-sans flex items-center gap-0.5">
      Mark<span class="text-primary-500 dark:text-primary-400 group-hover/logo:text-primary-400 transition-colors duration-300">Downify</span>
    </span>
  </div>
</template>
