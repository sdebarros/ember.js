/**
@module ember
@submodule ember-application
@private
*/

import { set } from "ember-metal/property_set";
import EmberObject from "ember-runtime/system/object";
import run from "ember-metal/run_loop";

/**
  The `ApplicationInstance` encapsulates all of the stateful aspects of a
  running `Application`.

  At a high-level, we break application boot into two distinct phases:

  * Definition time, where all of the classes, templates, and other
    dependencies are loaded (typically in the browser).
  * Run time, where we begin executing the application once everything
    has loaded.

  Definition time can be expensive and only needs to happen once since it is
  an idempotent operation. For example, between test runs and FastBoot
  requests, the application stays the same. It is only the state that we want
  to reset.

  That state is what the `ApplicationInstance` manages: it is responsible for
  creating the container that contains all application state, and disposing of
  it once the particular test run or FastBoot request has finished.
*/

export default EmberObject.extend({
  /**
    The application instance's container. The container stores all of the
    instance-specific state for this application run.

    @property {Ember.Container} container
  */
  container: null,

  /**
    The application's registry. The registry contains the classes, templates,
    and other code that makes up the application.

    @property {Ember.Registry} registry
  */
  registry: null,

  /**
    The DOM events for which the event dispatcher should listen.

    By default, the application's `Ember.EventDispatcher` listens
    for a set of standard DOM events, such as `mousedown` and
    `keyup`, and delegates them to your application's `Ember.View`
    instances.

    @private
    @property {Object} customEvents
  */
  customEvents: null,

  /**
    The root DOM element of the Application as an element or a
    [jQuery-compatible selector
    string](http://api.jquery.com/category/selectors/).

    @private
    @property {String|DOMElement} rootElement
  */
  rootElement: null,

  init: function() {
    this._super.apply(this, arguments);
    this.container = this.registry.container();

    // Currently, we cannot put the application instance into the container
    // because the registry is "sealed" by this point and we do not yet
    // support container-specific subregistries. This code puts the instance
    // directly into the container's cache so that lookups work, but it
    // would obviously be much better to support registering on the container
    // directly.
    //
    // Why do we need to put the instance in the container in the first place?
    // Because we need a good way for the root route (a.k.a ApplicationRoute)
    // to notify us when it has created the root-most view. That view is then
    // appended to the rootElement, in the case of apps, to the fixture harness
    // in tests, or rendered to a string in the case of FastBoot.
    this.container.cache['-application-instance:main'] = this;
  },

  /**
    Instantiates and sets up the router, optionally overriding the default
    location. This is useful for manually starting the app in FastBoot or
    testing environments, where trying to modify the URL would be
    inappropriate.

    @param options
    @private
  */
  setupRouter: function(options) {
    var router = this.container.lookup('router:main');

    var location = options.location;
    if (location) { set(router, 'location', location); }

    router._setupLocation();
    router.setupRouter(true);
  },

  /**
    This hook is called by the root-most Route (a.k.a. the ApplicationRoute)
    when it has finished creating the root View. By default, we simply take the
    view and append it to the `rootElement` specified on the Application.

    In cases like FastBoot and testing, we can override this hook and implement
    custom behavior, such as serializing to a string and sending over an HTTP
    socket rather than appending to DOM.

    @param view {Ember.View} the root-most view
    @private
  */
  didCreateRootView: function(view) {
    view.appendTo(this.rootElement);
  },

  /**
    Tells the router to start routing. The router will ask the location for the
    current URL of the page to determine the initial URL to start routing to.
    To start the app at a specific URL, call `handleURL` instead.

    Ensure that you have called `setupRouter()` on the instance before using
    this method.

    @private
  */
  startRouting: function() {
    var router = this.container.lookup('router:main');
    if (!router) { return; }

    var isModuleBasedResolver = !!this.registry.resolver.moduleBasedResolver;
    router.startRouting(isModuleBasedResolver);
  },

  /**
    Directs the router to route to a particular URL. This is useful in tests,
    for example, to tell the app to start at a particular URL. Ensure that you
    have called `setupRouter()` before calling this method.

    @param url {String} the URL the router should route to
    @private
  */
  handleURL: function(url) {
    var router = this.container.lookup('router:main');

    return router.handleURL(url);
  },

  /**
    @private
  */
  setupEventDispatcher: function() {
    var dispatcher = this.container.lookup('event_dispatcher:main');

    dispatcher.setup(this.customEvents, this.rootElement);

    return dispatcher;
  },

  /**
    @private
  */
  willDestroy: function() {
    this._super.apply(this, arguments);
    run(this.container, 'destroy');
  }
});
