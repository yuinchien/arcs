/**
 * @license
 * Copyright (c) 2017 Google Inc. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * Code distributed by Google as part of this project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

import {assert} from './chai-web.js';
import Shape from '../shape.js';
import Type from '../type.js';
import Manifest from '../manifest.js';


describe('shape', function() {
  it('finds type variable references in views', function() {
    let shape = new Shape('Test', [{type: Type.newVariableReference('a')}], []);
    assert.equal(shape._typeVars.length, 1);
    assert(shape._typeVars[0].field == 'type');
    assert(shape._typeVars[0].object[shape._typeVars[0].field].variableReference == 'a');
  });

  it('finds type variable references in slots', function() {
    let shape = new Shape('Test', [], [{name: Type.newVariableReference('a')}]);
    assert.equal(shape._typeVars.length, 1);
    assert(shape._typeVars[0].field == 'name');
    assert(shape._typeVars[0].object[shape._typeVars[0].field].variableReference == 'a');
  });

  it('upgrades type variable references', function() {
    let shape = new Shape('Test',
      [
        {name: Type.newVariableReference('a')},
        {type: Type.newVariableReference('b'), name: 'singleton'},
        {type: Type.newVariableReference('b').setViewOf(), name: 'set'}
      ],
      [
        {name: Type.newVariableReference('a')},
      ]);
    assert.equal(shape._typeVars.length, 4);
    let type = Type.newInterface(shape);
    let map = new Map();
    type = type.assignVariableIds(map);
    assert(map.has('a'));
    assert(map.has('b'));
    shape = type.interfaceShape;
    assert(shape.views[0].name.variableId == shape.slots[0].name.variableId);
    assert(shape.views[1].type.variableId == shape.views[2].type.setViewType.variableId);
  });

  it('matches particleSpecs', async () => {
    let manifest = await Manifest.parse(`
        schema Test
        schema NotTest

        particle P
          P(in Test foo)

        particle Q
          Q(in Test foo, in Test foo, in Test foo)

        particle R
          R(out NotTest foo, in NotTest bar, out Test far)

        particle S
          S(in NotTest bar, out Test far, out NotTest foo)
      `);
      let type = Type.newEntity(manifest.schemas.Test);
      let shape = new Shape('Test', [{name: 'foo'}, {direction: 'in'}, {type}], []);
      assert(!shape.particleMatches(manifest.particles[0]));
      assert(shape.particleMatches(manifest.particles[1]));
      assert(shape.particleMatches(manifest.particles[2]));
      assert(shape.particleMatches(manifest.particles[3]));
  });

  it('matches particleSpecs with slots', async () => {
    let manifest = await Manifest.parse(`
        schema Test

        particle P
          P(in Test foo)

        particle Q
          Q(in Test foo)
          consume one

        particle R
          R(in Test foo)
          consume one
            provide set of other

        particle S
          S(in Test foo)
          consume notTest
            provide one
            provide set of randomSlot
      `);
      let type = Type.newEntity(manifest.schemas.Test);
      let shape = new Shape('Test', [{direction: 'in', type}], [{name: 'one'}, {direction: 'provide', isSet: true}]);

      assert(!shape.particleMatches(manifest.particles[0]));
      assert(!shape.particleMatches(manifest.particles[1]));
      assert(shape.particleMatches(manifest.particles[2]));
      assert(shape.particleMatches(manifest.particles[3]));
  });
});
