<template>
  <div class="flex items-center gap-2 font-sans select-none">
    <!-- Clean Geometric Icon representing file conversion to lines of Markdown (gradient-free) -->
    <svg
      width="36"
      height="36"
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      class="shrink-0 text-primary-500 dark:text-primary-400"
    >
      <!-- Base Document Layer -->
      <rect
        x="4"
        y="6"
        width="22"
        height="26"
        rx="3"
        class="fill-neutral-200 dark:fill-neutral-800"
        stroke="currentColor"
        stroke-width="2"
      />

      <!-- Top Layer Page Fold / Downward Transforming Arrow (Conversion representation) -->
      <path
        d="M18 6H23.5L26 8.5V13"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

      <!-- Markdown Symbol 'M↓' style lines -->
      <!-- Left Vertical -->
      <line
        x1="9"
        y1="12"
        x2="9"
        y2="24"
        stroke="var(--ui-primary)"
        stroke-width="2.5"
        stroke-linecap="round"
      />
      <!-- Right Vertical -->
      <line
        x1="17"
        y1="12"
        x2="17"
        y2="24"
        stroke="var(--ui-primary)"
        stroke-width="2.5"
        stroke-linecap="round"
      />
      <!-- Middle connecting V -->
      <path
        d="M9 12L13 18L17 12"
        stroke="var(--ui-primary)"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

      <!-- Downward Arrow representing Output / Convert -->
      <path
        d="M25 21V28M25 28L22 25M25 28L28 25"
        stroke="var(--ui-primary)"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>

    <!-- Text Branding -->
    <span class="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
      Mark<span class="text-primary-500 dark:text-primary-400">Downify</span>
    </span>
  </div>
</template>
