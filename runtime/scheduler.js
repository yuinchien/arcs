// @license
// Copyright (c) 2017 Google Inc. All rights reserved.
// This code may only be used under the BSD style license found at
// http://polymer.github.io/LICENSE.txt
// Code distributed by Google as part of this project is also
// subject to an additional IP rights grant found at
// http://polymer.github.io/PATENTS.txt
'use strict';

import tracing from '../tracelib/trace.js';
import assert from '../platform/assert-web.js';

class Scheduler {
  constructor() {
    this.frameQueue = [];
    this.targetMap = new Map();
    this._finishNotifiers = [];
    this._idle = Promise.resolve();
    this._idleResolver = null;
    this._idleCallback = null;
  }

  clone() {
    return new Scheduler();
  }

  set idleCallback(idleCallback) { this._idleCallback = idleCallback; }

  enqueue(view, eventRecords) {
    let trace = tracing.flow({cat: 'view', name: 'ViewBase::_fire flow'}).start();
    if (this.frameQueue.length == 0 && eventRecords.length > 0)
      this._asyncProcess();
    if (!this._idleResolver) {
      this._idle = new Promise((resolve, reject) => this._idleResolver = resolve);
    }
    for (let record of eventRecords) {
      let frame = this.targetMap.get(record.target);
      if (frame == undefined) {
        frame = {target: record.target, views: new Map(), traces: []};
        this.frameQueue.push(frame);
        this.targetMap.set(record.target, frame);
      }
      frame.traces.push(trace);
      let viewEvents = frame.views.get(view);
      if (viewEvents == undefined) {
        viewEvents = new Map();
        frame.views.set(view, viewEvents);
      }
      let kindEvents = viewEvents.get(record.kind);
      if (kindEvents == undefined) {
        kindEvents = [];
        viewEvents.set(record.kind, kindEvents);
      }
      kindEvents.push(record);
    }
  }

  get busy() {
    return this.frameQueue.length > 0;
  }

  get idle() {
    return this._idle;
  }

  _asyncProcess() {
    Promise.resolve().then(() => {
      assert(this.frameQueue.length > 0, '_asyncProcess should not be invoked with 0 length queue');
      let frame = this.frameQueue.shift();
      this.targetMap.delete(frame.target);
      if (this.frameQueue.length > 0)
        this._asyncProcess();
      this._applyFrame(frame);
      if (this.frameQueue.length == 0) {
        this._idleResolver();
        this._idleResolver = null;
        if (this._idleCallback) {
          this._idleCallback();
        }
      }
    });
  }

  _applyFrame(frame) {
    let trace = tracing.start({cat: 'scheduler', name: 'Scheduler::_applyFrame', args: {target: frame.target ? frame.target.constructor.name : 'NULL TARGET'}});

    let totalRecords = 0;
    for (let [view, kinds] of frame.views.entries()) {
      for (let [kind, records] of kinds.entries()) {
        let record = records[records.length - 1];
        record.callback(record.details);
      }
    }

    frame.traces.forEach(trace => trace.end());

    trace.end();
  }
}

// TODO: Scheduler needs to be per arc, once multi-arc support is implemented.
export default new Scheduler();
