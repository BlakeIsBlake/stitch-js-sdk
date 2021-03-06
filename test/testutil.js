const stitch = require('../src');
const constants = require('./constants');

export const extractTestFixtureDataPoints = (test) => {
  const {
    userData: {
      apiKey: { key: apiKey },
      group: { groupId }
    },
    options: { baseUrl: serverUrl }
  } = test;
  return { apiKey, groupId, serverUrl };
};

export const buildAdminTestHarness = async(seedTestApp, apiKey, groupId, serverUrl) => {
  const harness = new TestHarness(apiKey, groupId, serverUrl);
  await harness.authenticate();
  if (seedTestApp) {
    await harness.createApp();
  }
  return harness;
};

export const buildClientTestHarness = async(apiKey, groupId, serverUrl) => {
  const harness = await buildAdminTestHarness(true, apiKey, groupId, serverUrl);
  await harness.setupStitchClient();
  return harness;
};

class TestHarness {
  constructor(apiKey, groupId, serverUrl = constants.DEFAULT_SERVER_URL) {
    this.apiKey = apiKey;
    this.groupId = groupId;
    this.serverUrl = serverUrl;
    this.adminClient = new stitch.Admin(this.serverUrl);
  }

  async authenticate() {
    await this.adminClient.authenticate('apiKey', this.apiKey);
  }

  async configureUserpass(userpassConfig = {
    emailConfirmationUrl: 'http://emailConfirmURL.com',
    resetPasswordUrl: 'http://resetPasswordURL.com',
    confirmEmailSubject: 'email subject',
    resetPasswordSubject: 'password subject'
  }) {
    return await this.app().authProviders().create({
      type: 'local-userpass',
      config: userpassConfig
    });
  }

  configureAnon() {
    return this.app().authProviders().create({
      type: 'anon-user'
    });
  }

  async createApp(testAppName = 'test-app') {
    this.testApp = await this.apps().create({ name: testAppName });
    return this.testApp;
  }

  async createUser(email = 'test_user@domain.com', password = 'password') {
    this.userCredentials = { username: email, password };
    this.user = await this.app().users().create({ email, password });
    return this.user;
  }

  async setupStitchClient() {
    await this.configureUserpass();
    await this.createUser();

    this.stitchClient = new stitch.StitchClient(this.testApp.client_app_id, { baseUrl: this.serverUrl });
    await this.stitchClient.authenticate('userpass', this.userCredentials);
  }

  async cleanup() {
    if (this.testApp) {
      await this.appRemove();
    }
  }

  apps() {
    return this.adminClient.apps(this.groupId);
  }

  app() {
    return this.apps().app(this.testApp._id);
  }

  async appRemove() {
    await this.app().remove();
    this.testApp = undefined;
  }

  appsV2() {
    return this.adminClient.v2().apps(this.groupId);
  }

  appV2() {
    return this.appsV2().app(this.testApp._id);
  }
}
