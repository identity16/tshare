FROM node:24-alpine
ENV NODE_ENV=production TSHARE_ROOT=/data
WORKDIR /app
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node web ./web
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 8791
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s CMD node -e "fetch('http://127.0.0.1:8791/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
ENTRYPOINT ["node", "src/cli.js"]
CMD ["serve", "--host", "0.0.0.0"]
