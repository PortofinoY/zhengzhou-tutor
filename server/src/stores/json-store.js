const { Store } = require('../store');

class JsonStore extends Store {
  constructor(dbPath, options = {}) {
    super(dbPath, options);
    this.driver = 'json';
  }

  async initialize() {
    this.load();
    return this;
  }

  async beginRequest() {
    this.load();
  }

  async commitRequest() {}

  async rollbackRequest() {
    this.load();
  }

  async close() {}

  async transaction(work) {
    const before = this.snapshot();
    try {
      return await work(this);
    } catch (error) {
      this.data = before;
      this.save();
      throw error;
    }
  }
}

module.exports = {
  JsonStore
};
