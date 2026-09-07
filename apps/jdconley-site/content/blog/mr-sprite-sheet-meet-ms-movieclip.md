---
title: Mr. Sprite Sheet, Meet Ms. MovieClip
date: 2010-03-09T16:18:00.000-08:00
slug: mr-sprite-sheet-meet-ms-movieclip
description: In Youtopia we wanted to have animations. We also wanted to have thousands of buildings on the screen at once. Anyone who has done a lot of Flash development will tell you that…
tags:
  - as3
  - tuning
draft: false
updated: 2011-07-27T00:02:30.617-07:00
bloggerId: tag:blogger.com,1999:blog-1741199026308686058.post-6147256010649956063
originalUrl: http://blog.jdconley.com/2010/03/mr-sprite-sheet-meet-ms-movieclip.html
---

In [Youtopia](http://pushbuttonengine.com/devgallery/youtopia) we wanted to have animations. We also wanted to have thousands of buildings on the screen at once. Anyone who has done a lot of Flash development will tell you that these two things are not compatible. You simply cannot create that many movie clip instances and have them playing. But, all is not lost! With a sprite sheet animation system like the one in [PushButton Engine](http://pushbuttonengine.com/) (PBE) you can have your cake and eat it too!

Sprite sheets are as old as video games that have pre-rendered art. The basic idea is you draw a bunch of frames of an animation (or multiple animations) and put them on a single image. You can see some examples [online](http://www.mariomayhem.com/downloads/sprites/super_mario_bros_sprites.php). The software knows how to read and draw a frame of the desired animation from that one big graphic, and that's what you see on the screen. Easy!

However, sprite sheets also have their down sides. First, they aren't made to scale. We're talking bitmap graphics here. Your resized image is only going to look as good as your resizing code can make it look (which usually is not very good). Second, animations with a lot of frames can create very large file sizes. A five second animation at 30 frames per second means you end up with all 150 frames of the animation on a single image.

This is where movie clips come in. "But wait," you say with bewilderment, "didn't you tell me earlier we couldn't use movie clips." Why yes I did, so let me explain. Flash was designed from its inception to create small file sizes for downloads. It was also designed to support resizing. This is done using [vector graphics](http://en.wikipedia.org/wiki/Vector_graphics) which can be animated in a movie clip. We should take advantage of this feature.

One of the bits of code I contributed to PBE was the SWFSpriteSheetComponent. It takes an instance of a MovieClip and converts each frame into a bitmap. It then exposes these bitmaps to the PBE rendering engine as if they were part of a sprite sheet. Viola! You get the best of both worlds. A small download size, the option to render your animation at any scale, and super awesome performance. Using this technique and well drawn vector graphics we were able to save over 5X on the download size of Youtopia as compared to sprite sheets and get the same performance!

NOTE: If you're not familiar with PBE you might want to skim through [the docs](http://pushbuttonengine.com/docs/) before diving into my code below. I'd highly recommend the video talks. The composite entity architecture can throw you for a loop if you're not used to seeing it.

Using the SWFSpriteSheetComponent is really easy and I've created an example application to show it off. The application spawns a sleeping [Ben Garney](http://coderhump.com/) every second and makes him move. There are some animated zzz's to indicate that, regardless of the smile, he is in fact sleeping. Ben is the lead developer on PBE, so he's getting picked on. ;) [Click here](http://jdconley.com/garney/) to see the app. You can also [download the source](https://docs.google.com/viewer?a=v&pid=explorer&chrome=true&srcid=0B7Ew2HKAAmajNTI5NDBiMjktOWFlMC00M2JiLTk0ZWUtNmY0MGVmNzc3MzUx&hl=en_US) and follow along at home.

The process starts by creating and exporting a MovieClip in your fla with a flash.display.MovieClip base class. Give it a class name that you're not going to forget. In this example we call it "z\_fx". Then publish the swf and put it somewhere that your PBE application can find it. The example has a "res" folder where I put the effects.swf. The CS3 format effects.fla (created for me by Jesse Tudela here at Hive7) is in the res folder in the [download](https://docs.google.com/viewer?a=v&pid=explorer&chrome=true&srcid=0B7Ew2HKAAmajNTI5NDBiMjktOWFlMC00M2JiLTk0ZWUtNmY0MGVmNzc3MzUx&hl=en_US) if you want to check it out. Now on to the code!

For easy deployment we embed the effects.swf and the garney.png file using PBE's ResourceBundle like so:  

```actionscript
package
{
   import com.pblabs.engine.resource.ResourceBundle;

   public class Resources extends ResourceBundle
   {
       public static const EFFECTS_PATH:String = "../res/effects.swf";
       public static const GARNEY_PATH:String = "../res/garney.png";
      
       [Embed(source="../res/effects.swf",mimeType='application/octet-stream')]
       public var effects:Class;

       [Embed(source="../res/garney.png",mimeType='application/octet-stream')]
       public var garney:Class;
   }
}
```

Now on to our "main" method. We start off by creating a SceneView, which is the target where PBE will draw stuff. Then we call startup, load our embedded resources, and create the scene. This is all standard PBE initialization. A ThinkingComponent is added to the scene entity in order to spawn Garney instances based on the game's virtual time. And finally, we register our garney entity factory with the TemplateManager and spawn a Garney!  

```actionscript
// The SceneView is where PBE will draw to
var sv:SceneView = new SceneView();
addChild(sv);

// Start the logger, processmanager, etc
PBE.startup(this);

// Embed my resources
PBE.addResources(new Resources());

// Create a basic scene through code
var scene:IEntity = PBE.initializeScene(sv);

// ThinkingComponent is an efficient Timer based on virtualTime rather than real time
scene.addComponent(new ThinkingComponent(), "spawnThinker");

// Register the callback for my "garney" template that will be used to instantiate garneys
setupTemplate();

// Spawn a garney then kick off the timer. They keep coming, eeek!
spawn();
```

The setupTemplate method is where all the interesting stuff happens. In here we choose all the components that make up our entity and determine how they relate to each other.  

```actionscript
private function setupTemplate():void
{
   PBE.templateManager.registerEntityCallback("garney",
       function():IEntity
       {
           var e:IEntity = PBE.allocateEntity();
          
           // Spatial component knows where to put the garney
           var spatial:SimpleSpatialComponent = new SimpleSpatialComponent();
           spatial.spatialManager = PBE.spatialManager;
          
           // Rendering component knows how to draw the garney
           var render:SpriteRenderer = new SpriteRenderer();
           render.fileName = Resources.GARNEY_PATH;
           render.positionProperty = new PropertyReference("@spatial.position");
           render.scene = PBE.scene;
          
           // Here's the SWFSpriteSheet magic!
           var fxSheet:SWFSpriteSheetComponent = new SWFSpriteSheetComponent();
           fxSheet.swf = PBE.resourceManager.load(Resources.EFFECTS_PATH, SWFResource) as SWFResource;
           fxSheet.clipName = "z_fx";
          
           // Fx Rendering component knows how to draw the z's from the spritesheet
           var fxRender:SpriteSheetRenderer = new SpriteSheetRenderer();
           fxRender.positionProperty = new PropertyReference("@spatial.position");
           fxRender.positionOffset = new Point(30, 10);
           fxRender.scene = PBE.scene;
          
           // Need an animation controller to assign and animate the sprite sheet on the renderer
           var animator:AnimationController = new AnimationController();
           animator.spriteSheetReference = new PropertyReference("@fxRender.spriteSheet");
           animator.currentFrameReference = new PropertyReference("@fxRender.spriteIndex");

           var idle:AnimationControllerInfo = new AnimationControllerInfo();
           idle.loop = true;
           idle.spriteSheet = fxSheet;
           idle.frameRate = 30; // In PBE your animation framerate can be independent of your stage framerate

           animator.animations["idle"] = idle;
           animator.defaultAnimation = "idle";
          
           // Garneys self destruct after a random amount of time
           var suicide:ThinkingComponent = new ThinkingComponent();
          
           // Add all the components to the entity
           e.addComponent(spatial, "spatial");
           e.addComponent(render, "render");
           e.addComponent(fxSheet, "fxSheet");
           e.addComponent(fxRender, "fxRender");
           e.addComponent(animator, "animator");
           e.addComponent(suicide, "suicide");
          
           e.initialize();
           return e;
       });
}
```

The "garney" template is made up of six distinct components. Each of these components perfmorm a small piece of highly specialized work. I created two components for rendering, one for the garney sprite and one for the animated z's. The z's use a SpriteSheetRenderer and a SWFSpriteSheetComponent. Both renderers are positioned based on the position property on the spatial component. The AnimationController is a very powerful class that lets you do things like automatically change out the animation being rendered based on an event firing. But, that's probably a post for another day. In this case it just plays the z's animation on the fxRender component.

All of this gets tied together in the spawn method, which creates a new garney entity based on the template, assigns it some random values for position and velocity, makes sure it draws the most recently spawned entity on top, picks a random time for the entity to commit suicide, and schedules the next spawn.  

```actionscript
private function spawn():void
{
   // Create a garney!
   var garney:IEntity = PBE.templateManager.instantiateEntity("garney");
  
   // Randomly position a garney!
   var spatial:SimpleSpatialComponent = garney.lookupComponentByName("spatial") as SimpleSpatialComponent;
   spatial.position = new Point(Math.random() * 800, Math.random() * 600);
   spatial.velocity =  new Point(Math.random() * 50 * (Math.random() < .5 ? -1 : 1), Math.random() * 50 * (Math.random() < .5 ? -1 : 1));
  
   // Choose when this garney commits suicide, up to 20,000 virtual MS from now
   var suicide:ThinkingComponent = garney.lookupComponentByName("suicide") as ThinkingComponent;
   suicide.think(garney.destroy, Math.random() * 20000);
  
   // Set the zIndex so our components render consistently in spawn-order
   var render:DisplayObjectRenderer = garney.lookupComponentByName("render") as DisplayObjectRenderer;
   render.zIndex =   _zIndex;
  
   var fxRender:DisplayObjectRenderer = garney.lookupComponentByName("fxRender") as DisplayObjectRenderer;
   fxRender.zIndex =   _zIndex;
  
   // Grab the global spawn thinking component and schedule a think
   var thinker:ThinkingComponent = PBE.lookupComponentByName("SceneDB", "spawnThinker") as ThinkingComponent;
   thinker.think(spawn, 1000);
}
```

That's all there is to it! There are some caveats, though. Make sure you keep your source MovieClips really simple. Just like it is CPU intensive to play a complex MovieClip, it is CPU intensive to render each frame to a bitmap. In addition, nested clips with separate timelines and as3 code in the clip that is not based on the timeline will not be executed. This works really well for simple frame based animations, but is not designed for complex interactive clips with tweening. YMMV.

Let me know if you have any questions or if you're interested in any other PBE related topics. Also, PBE 1.0 is out! Download it from the [project site](http://pushbuttonengine.com/download/). This example includes the 1.0 release swc.  

-   [Download the source code](https://docs.google.com/viewer?a=v&pid=explorer&chrome=true&srcid=0B7Ew2HKAAmajNTI5NDBiMjktOWFlMC00M2JiLTk0ZWUtNmY0MGVmNzc3MzUx&hl=en_US)
-   [See the demo](http://jdconley.com/garney/)
