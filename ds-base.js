(() => {
  for (const p of ["tokens/fonts.css","tokens/colors.css","tokens/worlds.css","tokens/typography.css","tokens/spacing.css","tokens/shape.css","components/components.css","styles.css"]) {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = './' + p;
    document.head.appendChild(l);
  }
})();
