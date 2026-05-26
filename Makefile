.PHONY: install start android ios web lint test type-check check clean help

install:
	npm install

start:
	npx expo start

android:
	npx expo start --android

ios:
	npx expo start --ios

web:
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
	@echo "  start      - Start Expo dev server"
	@echo "  android    - Start Expo dev server targeting Android"
	@echo "  ios        - Start Expo dev server targeting iOS"
	@echo "  web        - Start Expo dev server targeting web"
	@echo "  lint       - Run Expo lint"
	@echo "  test       - Run Jest tests"
	@echo "  type-check - Run TypeScript type checker"
	@echo "  check      - Run lint, type-check, and tests"
	@echo "  clean      - Remove node_modules and .expo cache"
	@echo "  help       - Show this help"
