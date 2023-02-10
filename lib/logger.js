const logger = require('debug')('jsondb')

module.exports = (name) => {
  const self = logger.extend(name)
  return {
    silly: self.extend('silly'),
    debug: self.extend('debug'),
    info: self.extend('info'),
    warn: self.extend('warn'),
    error: self.extend('error'),
    dev: true
  }
}
