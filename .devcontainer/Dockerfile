FROM mcr.microsoft.com/devcontainers/javascript-node:1-22-bookworm

# Playwright Chromium is used headless for the design-export audit and for
# per-block screenshot acceptance (docs/LAYOUT_RULES.md → «Приёмка блоков»).
# The base image lacks Chromium's system libraries, and the dev user is
# non-root, so install them here at build time (as root).

ENV PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers
ENV PLAYWRIGHT_VERSION=1.56.0

RUN apt-get update \
 && npx --yes playwright@${PLAYWRIGHT_VERSION} install-deps chromium \
 && npx --yes playwright@${PLAYWRIGHT_VERSION} install chromium \
 && chmod -R a+rX /opt/pw-browsers \
 && rm -rf /var/lib/apt/lists/* /root/.npm
