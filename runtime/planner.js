// Copyright (c) 2017 Google Inc. All rights reserved.
// This code may only be used under the BSD style license found at
// http://polymer.github.io/LICENSE.txt
// Code distributed by Google as part of this project is also
// subject to an additional IP rights grant found at
// http://polymer.github.io/PATENTS.txt

let {Strategy, Strategizer} = require('../strategizer/strategizer.js');
let oldRecipe = require('./recipe.js');
let Recipe = require('./new-recipe.js');
let Arc = require('./arc.js');
let Loader = require('./loader.js');
let systemParticles = require('./system-particles.js');

class InitPopulation extends Strategy {
  async generate(strategizer) {
    if (strategizer.generation == 0) {
      var r = new oldRecipe.NewRecipeBuilder()
        .addParticle("WishlistFor")
          .connectConstraint("wishlist", "wishlist")
          .connectConstraint("person", "person")
        .addParticle("Recommend")
          .connectConstraint("known", "list")
          .tag("gift list")
          .connectConstraint("population", "wishlist")
          .connectConstraint("recommendations", "recommended")
        .addParticle("SaveList")
          .connectConstraint("list", "list")
        .addParticle("Choose")
          .connectConstraint("singleton", "person")
        .addParticle("ListView")
          .connectConstraint("list", "list")
        .addParticle("Chooser")
          .connectConstraint("choices", "recommended")
          .connectConstraint("resultList", "list")
        .build();

        return { results: [{result: r, score: 1}], generate: null };
     }
     return { results: [], generate: null };
  }
}

class ResolveParticleByName extends Strategy {
  constructor(loader) {
    super();
    this.loader = loader;
  }
  async generate(strategizer) {
    var loader = this.loader;
    var results = Recipe.over(strategizer.generated, new class extends Recipe.Walker {
      onParticle(recipe, particle) {
        if (particle.impl == undefined) {
          var impl = loader.loadParticle(particle.name, true);
          if (impl == undefined)
            return;
          return (recipe, particle) => {
            particle.impl = impl;
            for (var connectionName of impl.spec.connectionMap.keys()) {
              var speccedConnection = impl.spec.connectionMap.get(connectionName);
              var connection = particle.connections[connectionName];
              if (connection == undefined) {
                connection = particle.addConnectionName(connectionName);
              }
              // TODO: don't just overwrite here, check that the types
              // are compatible if one already exists.
              connection.type = speccedConnection.type;
            }
          }
        }
      }
    }(strategizer, Recipe.Walker.ApplyAll));

    return { results, generate: null };
  }
}

class AssignViewsByTagAndType extends Strategy {
  constructor(arc) {
    super();
    this.arc = arc;
  }
  async generate(strategizer) {
    var arc = this.arc;
    var results = Recipe.over(strategizer.generated, new class extends Recipe.Walker {
      onViewConnection(recipe, viewConnection) {
        if (viewConnection.view) {
          let view = viewConnection.view;
          if (view.isResolved())
            return;
          if (view.type == undefined)
            return;
          return arc.findViews(view.type, view.tags).map(newView =>
            ((recipe, viewConnection) => viewConnection.view.id = newView.id));
        }
      }
    }(strategizer));

    return { results, generate: null };
  }
}

class CreateViews extends Strategy {
  // TODO: move generation to use an async generator.
  async generate(strategizer) {
    var results = Recipe.over(strategizer.generated, new class extends Recipe.Walker {
      onRecipe(recipe) {
        this.score = 0;
      }

      onView(recipe, view) {
        if (!view.id && !view.create) {
          this.score--;
          return (recipe, view) => view.create = true;
        }
      }
    }(strategizer, Recipe.Walker.ApplyAll));

    return { results, generate: null };
  }
}


class Planner {
  async plan(arc) {
    let strategies = [
      new InitPopulation(),
      new CreateViews(),
      new ResolveParticleByName(arc._loader),
      new AssignViewsByTagAndType(arc)];
    let strategizer = new Strategizer(strategies, [], {
      maxPopulation: 100,
      generationSize: 1000,
      discardSize: 20,
    });
    // TODO: Repeat until...?
    console.log(await strategizer.generate());
    console.log(await strategizer.generate());
    console.log(await strategizer.generate());
    return strategizer.population; //.filter(possiblePlan => possiblePlan.ready);
  }
}

(async () => {
  var loader = new Loader();
  systemParticles.register(loader);
  var a = new Arc({id: "test-plan-arc", loader});
  var p = new Planner();
  var population = await(p.plan(a));
  console.log(population.length);
})();