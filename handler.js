'use strict';

const _ = require('lodash');

require('lambda-git')();

const handler = fn => (event, context, callback) => {
  const data = event.body[0] === '{' ? JSON.parse(event.body) : event.body;
  fn(data, event, context).catch(err =>
    ({statusCode: 500, message: String(err)})
  ).then(resp => {
    if(!resp.statusCode) resp.statusCode = 200;
    if(typeof resp.body !== 'string') resp.body = JSON.stringify(resp.body);
    callback(null, resp);
  });
};


module.exports.rebasebot = handler((data, event, context) => {
  try {
    if (!data)
      return callback(null, {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Invalid input ',
          input: data,
        }),
      });

    const pull_request = data.pull_request;
    if (!pull_request)
      return callback(null, {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Input is not a pull request',
          data: data,
        }),
      });
    const labels = pull_request.labels;
    if (!labels)
      return callback(null, {
        statusCode: 200,
        body: JSON.stringify({
          message: 'No labels on pull request, not doing anything',
          input: data,
        }),
      });

    const labelNames = labels.map(label => label.name);
    if (!labelNames.includes('rebasebot')) {
      return callback(null, {
        statusCode: 200,
        body: JSON.stringify({
          message: 'No rebasebot label on pull request, not doing anything',
          labelNames: labelNames,
        }),
      });
    }
    const repoName = _.get(pull_request, ['head', 'repo', 'name']);
    callback(null, {
      statusCode: 200,
      body: JSON.stringify({
        message: 'OK, I would want to rebase that branch',
        labelNames: labelNames,
        repoName: repoName,
        data: data,
      }),
    });
  } catch(e) {
    callback(null, { statusCode: 500, body: String(e) });
  }
};
