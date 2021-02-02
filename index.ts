import { promises as fs } from 'fs'
import { Plugin, ViteDevServer } from 'vite'

interface ServerHandler {
  process?: (path: string) => Promise<string | Buffer | null>
  setup?: (server: ViteDevServer) => void
}

export function serveDir(root: string) {
  if (!root.endsWith('/')) {
    root = root + '/'
  }
  if (root === '/') {
    throw 'cannot serve root /'
  }
  const process = async (path: string) => {
    if (path.endsWith('/')) {
      const dir = await fs.readdir(root + path)
      const result = []
      for (const file of dir) {
        const stat = await fs.stat(root + path + file)
        result.push({ name: file, timestamp: stat.mtime.getTime() })
      }
      return JSON.stringify(result)
    } else {
      return await fs.readFile(root + path)
    }
  }
  return { process }
}

export function fsPlugin(opts: {[route: string]: ServerHandler}): Plugin {
  return {
    name: "fsPlugin:custom-serve",
    configureServer(server) {
      const optsResolved = []
      for (const route in opts) {
        if (Object.prototype.hasOwnProperty.call(opts, route)) {
          optsResolved.push({ route, handler: opts[route] });
        }
      }
      // console.debug("configureServer", optsResolved)
      optsResolved.forEach(({ route, handler }) => {
        if (handler.setup != null) {
          handler.setup(server)
        }
        if (handler.process == null) return
        const h = handler.process
        server.middlewares.use(route, async (req, res, next) => {
          console.log('custom-server', route, req.url)
          try {
            const resp = await h(req.url!)
            if (resp != null) {
              res.write(resp)
              res.end()
              return
            }
          } catch (e) {
            console.warn('INTERNAL ERROR: ' + e)
            res.write('INTERNAL ERROR: ' + e)
            res.statusCode = 500 // TODO no effect
            res.end()
            return
          }
          next()
        })
      })
    }
  }
}
