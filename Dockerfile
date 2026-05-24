# syntax=docker/dockerfile:1

# Builds BOTH Go services into one image; compose picks which binary to run
# per service via `command:`. Static (CGO disabled) so the runtime stage can
# be a tiny alpine.
FROM golang:1.26-alpine AS build
WORKDIR /src
RUN apk add --no-cache git
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/shoplit-api ./cmd/shoplit-api \
 && CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/shoplit-redirect ./cmd/shoplit-redirect

FROM alpine:3.20
# ca-certificates: outbound HTTPS (OG fetch, Google OAuth, Neon/managed PG TLS).
# tzdata: correct timestamps in logs.
RUN apk add --no-cache ca-certificates tzdata \
 && adduser -D -u 10001 app
COPY --from=build /out/shoplit-api /usr/local/bin/shoplit-api
COPY --from=build /out/shoplit-redirect /usr/local/bin/shoplit-redirect
USER app
# Overridden per service in compose; api is the sensible default.
CMD ["shoplit-api"]
