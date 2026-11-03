const path = require('node:path')
const { app } = require('electron')

// Todo lo del juego vive fuera de userData para que sobreviva a reinstalar el launcher.
const root = path.join(app.getPath('appData'), '.lagang-launcher')

module.exports = {
  root,
  // versions/, libraries/ y assets/ compartidos entre servidores
  shared: path.join(root, 'shared'),
  instance: (id) => path.join(root, 'instances', id),
  java: (major) => path.join(root, 'runtime', `java-${major}`),
  settings: path.join(app.getPath('userData'), 'settings.json'),
  logs: path.join(root, 'logs'),
}
