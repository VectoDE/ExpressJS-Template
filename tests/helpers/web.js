const request = require('supertest');

/**
 * Browser-like client: keeps cookies between requests and reads the CSRF token from rendered forms.
 */
const browser = (app) => {
  const agent = request.agent(app);
  const csrfFrom = async (path) => {
    const res = await agent.get(path).set('Accept', 'text/html');
    const match = /name="_csrf" value="([^"]+)"/.exec(res.text);
    if (!match) {
      throw new Error(`No CSRF token on ${path} (status ${res.status})`);
    }
    return match[1];
  };
  const submit = async (path, form, formPath = path) => {
    const csrf = await csrfFrom(formPath);
    return agent
      .post(path)
      .type('form')
      .set('Accept', 'text/html')
      .send({ ...form, _csrf: csrf });
  };
  return { agent, csrfFrom, submit };
};

module.exports = { browser };
