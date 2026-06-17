.PHONY: install gen-env start start-tailnet android ios web lint test type-check check clean help

install:
	npm install

gen-env:
	@if [ ! -f .env.device ]; then echo "Error: .env.device not found (copy from .env.device.example: cp .env.device.example .env.device)"; exit 1; fi
	@if [ ! -f .env.central ]; then echo "Error: .env.central not found (copy from .env.central.example: cp .env.central.example .env.central)"; exit 1; fi
	@cat .env.device > .env
	@echo "" >> .env
	@cat .env.central >> .env

start: gen-env
	npx expo start

# Start Expo Go over Tailscale — no ngrok needed.
# Advertises the Tailscale IP so Expo Go on any device in the same Tailnet
# can reach the Metro bundler directly without a tunnel.
start-tailnet: gen-env
	REACT_NATIVE_PACKAGER_HOSTNAME=$$(tailscale ip -4) npx expo start --lan --go

android: gen-env
	npx expo start --android

ios: gen-env
	npx expo start --ios

web: gen-env
	npx expo start --web

lint:
	npx expo lint

test:
	npx jest

type-check:
	npx tsc --noEmit

check: lint type-check test

clean:
	rm -rf node_modules .expo

help:
	@echo "Available targets:"
	@echo "  install    - Install npm dependencies"
	@echo "  gen-env    - Merge .env.device + .env.central into .env"
	@echo "  start      - Start Expo dev server (runs gen-env first)"
	@echo "  start-tailnet - Start Expo Go over Tailscale (no ngrok; REACT_NATIVE_PACKAGER_HOSTNAME set to tailscale ip -4)"
	@echo "  android    - Start Expo dev server targeting Android (runs gen-env first)"
	@echo "  ios        - Start Expo dev server targeting iOS (runs gen-env first)"
	@echo "  web        - Start Expo dev server targeting web (runs gen-env first)"
	@echo "  lint       - Run Expo lint"
	@echo "  test       - Run Jest tests"
	@echo "  type-check - Run TypeScript type checker"
	@echo "  check      - Run lint, type-check, and tests"
	@echo "  clean      - Remove node_modules and .expo cache"
	@echo "  help       - Show this help"
