import { parseFile, traverse, t } from 'parser-core';

const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];

export function scanExpressFile(filePath) {
  let ast;
  try {
    ast = parseFile(filePath);
  } catch (e) {
    return { routes: [], mounts: [], imports: [] };
  }
  
  const routes = [];
  const mounts = [];
  const imports = [];

  traverse(ast, {
    // 1. Detect Routes (app.get, router.post, etc)
    CallExpression(path) {
      if (t.isMemberExpression(path.node.callee)) {
        const objectName = path.node.callee.object?.name;
        const methodName = path.node.callee.property?.name;

        // Handle standard methods
        if (
          (objectName === 'app' || objectName === 'router') &&
          METHODS.includes(methodName)
        ) {
          const args = path.node.arguments;
          if (args.length >= 2 && (t.isStringLiteral(args[0]) || t.isTemplateLiteral(args[0]))) {
            const routePath = t.isStringLiteral(args[0]) 
              ? args[0].value 
              : args[0].quasis.map(q => q.value.raw).join('*');

            const middlewares = [];
            let handlerName = 'anonymous';
            let requestSchema = null;

            for (let i = 1; i < args.length; i++) {
              const arg = args[i];
              if (i === args.length - 1) {
                 if (t.isIdentifier(arg)) handlerName = arg.name;
                 else handlerName = 'inline function';
              } else {
                 if (t.isIdentifier(arg)) {
                   middlewares.push(arg.name);
                 }
                 else if (t.isCallExpression(arg) && t.isIdentifier(arg.callee)) {
                   middlewares.push(arg.callee.name);
                   if (arg.callee.name === 'validate' || arg.callee.name === 'validator') {
                     if (arg.arguments.length > 0 && t.isIdentifier(arg.arguments[0])) {
                       requestSchema = arg.arguments[0].name; 
                     }
                   }
                 }
              }
            }

            routes.push({
              method: methodName.toUpperCase(),
              path: routePath,
              middleware: middlewares,
              handler: handlerName,
              requestSchema: requestSchema ? JSON.stringify({ type: 'object', description: `Inferred from ${requestSchema}` }) : '{}',
              responseSchema: '{}', 
              filePath
            });
          }
        }

        // 2. Detect Mount Points (app.use('/api', router))
        if (methodName === 'use' && (objectName === 'app' || objectName === 'router')) {
          const args = path.node.arguments;
          if (args.length >= 2 && t.isStringLiteral(args[0])) {
            mounts.push({
              prefix: args[0].value,
              identifier: t.isIdentifier(args[1]) ? args[1].name : null
            });
          }
        }
      }
    },

    // 3. Detect Imports/Requires to resolve identifiers to files
    ImportDeclaration(path) {
      const source = path.node.source.value;
      path.node.specifiers.forEach(spec => {
        imports.push({ local: spec.local.name, source });
      });
    },

    VariableDeclaration(path) {
      path.node.declarations.forEach(decl => {
        if (t.isCallExpression(decl.init) && t.isIdentifier(decl.init.callee, { name: 'require' })) {
          if (t.isIdentifier(decl.id)) {
            imports.push({ local: decl.id.name, source: decl.init.arguments[0].value });
          }
        }
      });
    }
  });

  return { routes, mounts, imports };
}
