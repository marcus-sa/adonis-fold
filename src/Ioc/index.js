'use strict'

/**
 * adonis-fold
 * Copyright(c) 2015-2015 Harminder Virk
 * MIT Licensed
*/

/**
 * @ignore
 */
const helpers = require('./helpers')
const _       = require('lodash')
const requireStack = require('require-stack')

/**
 * list of registered providers
 * @type {Object}
 * @private
 */
let providers = {}

/**
 * list of managers exposed by providers
 * to given option to extend.
 * @type {Object}
 * @private
 */
let providerManagers = {}

/**
 * list of providers extenders
 * @type {Object}
 * @private
 */
let providerExtenders = {}

/**
 * namespace for a given directory path
 * to be treated as autoload
 * @private
 */
let autoloadDirectory = {}

/**
 * binding alisaes
 * @type {Object}
 * @private
 */
let aliases = {}

/**
 * @module Ioc
 * @description Ioc container to store and resolve
 * depedencies with solid dependency injection.
 */
let Ioc = exports = module.exports = {}

/**
 * @description binding namespace to a given closure which
 * is executed everytime a namespace is fetched.
 * @method _bind
 * @param  {String} namespace
 * @param  {Function} closure
 * @param  {Boolean} singleton
 * @return {void}
 * @private
 */
Ioc._bind = function (namespace, closure, singleton) {
  if(typeof(closure) !== 'function'){
    throw new Error('Invalid arguments, bind expects a callback')
  }
  providers[namespace] = {closure,singleton}
}

/**
 * @description resolves eagerly loaded provider
 * by setting up dependencies in right order
 * @method _resolveProvider
 * @param  {Object}
 * @return {*}
 * @private
 */
Ioc._resolveProvider = function (provider) {
  if(!provider.singleton){
    return provider.closure(Ioc)
  }
  provider.instance = provider.instance || provider.closure(Ioc)
  return provider.instance
}

/**
 * @description calls provider extenders in a sequence
 * and pass key/return value to provider extend
 * method.
 * @method _extendProvider
 * @param  {Object}        extender
 * @param  {Object}        manager
 * @return {void}
 * @private
 */
Ioc._extendProvider = function (extender, manager) {

  _.each(extender, function (item) {

    const closure = item.closure
    const key = item.key

    const defination = closure(Ioc)
    manager.extend(key,defination)

  })
}

/**
 * autoloads a given file by making dynamic path
 * from namespace register for autoloading
 * @method _autoLoad
 * @param  {String}  namespace
 * @return {*}
 * @private
 */
Ioc._autoLoad = function (namespace) {
  namespace = namespace.replace(autoloadDirectory.namespace,autoloadDirectory.directoryPath)
  try{
    return requireStack(namespace)
  }catch(e){
    throw e
  }
}

/**
 * @description returns all registered providers
 * @method getProviders
 * @return {Object}
 * @public
 */
Ioc.getProviders = function () {
  return providers
}

/**
 * @description returns all registered managers
 * @method getManagers
 * @return {Object}
 * @public
 */
Ioc.getManagers = function (){
  return providerManagers
}

/**
 * @description returns all extend hooks
 * on service providers
 * @method getExtenders
 * @return {Object}
 * @public
 */
Ioc.getExtenders = function (){
  return providerExtenders
}

/**
 * @description register an object to a given namespace
 * which can be resolved out of Ioc container
 * @method bind
 * @param  {String} namespace
 * @param  {Function} closure
 * @return {void}
 * @throws {InvalidArgumentException} If closure is a not a function
 * @public
 */
Ioc.bind = function (namespace, closure) {
  Ioc._bind(namespace, closure)
}

/**
 * @description register an object as singleton to a given
 * namespace which can be resolved out of Ioc container
 * @method singleton
 * @param  {String} namespace
 * @param  {Function} closure
 * @return {void}
 * @throws {InvalidArgumentException} If closure is a not a function
 * @public
 */
Ioc.singleton = function (namespace, closure) {
  Ioc._bind(namespace, closure, true)
}

/**
 * @description register an object as a manager class which
 * needs to have extend method. It is binding required
 * to expose extend functionality
 * @method manager
 * @param  {String} namespace
 * @param  {*} defination
 * @return {void}
 * @throws {IncompleteImplementation} If defination does not have extend method
 * @public
 */
Ioc.manager = function (namespace, defination) {
  if(!defination.extend){
    throw new Error('Incomplete implementation, manager objects should have extend method')
  }
  providerManagers[namespace] = defination
}

/**
 * @description extends provider manager with the
 * power of type hinting dependencies
 * @method extend
 * @param  {String} namespace
 * @param  {String} key
 * @param  {Function} closure
 * @return {void}
 * @public
 */
Ioc.extend = function (namespace, key, closure) {
  if(typeof(closure) !== 'function'){
    throw new Error('Invalid arguments, extend expects a callback')
  }
  providerExtenders[namespace] = providerExtenders[namespace] || []
  providerExtenders[namespace].push({key, closure})
}


/**
 * @description setting up a directory to be autoloaded
 * under a given namespace
 * @method autoload
 * @param  {String} namespace
 * @param  {String} directoryPath
 * @return {void}
 * @public
 */
Ioc.autoload = function (namespace, directoryPath) {
  autoloadDirectory = {namespace,directoryPath}
}

/**
 * @description resolve any binding from ioc container
 * using it's namespace.
 * @method use
 * @param  {String} namespace
 * @return {*}
 * @public
 */
Ioc.use = function (namespace) {
  let type = null

  if(providers[namespace]){
    type = 'PROVIDER'

    /**
     * if provider supports extending and there are closures to
     * extend then invoke them first before resolving
     * provider
     */
    if(providerExtenders[namespace] && providerManagers[namespace]){
      Ioc._extendProvider(providerExtenders[namespace], providerManagers[namespace])
    }

    return Ioc._resolveProvider(providers[namespace])
  }

  if(helpers.isAutoLoadPath(autoloadDirectory,namespace)){
    type = 'LOCAL_MODULE'
    return Ioc._autoLoad(namespace)
  }

  if(aliases[namespace]){
    return Ioc.use(aliases[namespace])
  }

  throw new Error('Unable to resolve ' + namespace)

}

/**
 * @description alias any namespace registered under
 * ioc container
 * @method alias
 * @param  {String} key
 * @param  {String} namespace
 * @return {void}
 * @public
 */
Ioc.alias = function (key, namespace) {
  aliases[key] = namespace
}

/**
 * make an instance of class by injecting
 * required dependencies.
 * @method make
 * @param {Object} Binding
 * @return {*}
 * @public
 */
Ioc.make = function (Binding) {

  const _bind = Function.prototype.bind

  if(typeof(Binding) !== 'function' || typeof(Binding.constructor) !== 'function'){
    throw new Error('Invalid type, you can only make class instances using make method')
  }
  const injections = Binding.inject || helpers.introspect(Binding.toString())

  if(!injections || _.size(injections) === 0){
    return new Binding
  }

  const resolvedInjections = _.map(injections, function (injection) {
    return Ioc.use(injection)
  })

  return new (_bind.apply(Binding, [null].concat(resolvedInjections)))()
}

/**
 * @description it makes class instance using its namespace
 * and return requested method.
 * @method makeFunc
 * @param  {String} Binding
 * @return {Object}
 * @public
 */
Ioc.makeFunc = function (Binding) {

  const parts = Binding.split('.')
  if(parts.length !== 2){
    throw new Error('Unable to make ' + Binding)
  }

  const instance = Ioc.make(Ioc.use(parts[0]))
  const method = parts[1]

  if(!instance[method]){
    throw new Error(method + ' does not exists on ' + instance)
  }
  return {instance,method}

}