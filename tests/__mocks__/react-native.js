module.exports = {
  Platform: { OS: "test" },
  AppState: {
    addEventListener: () => ({ remove: () => {} }),
  },
};
