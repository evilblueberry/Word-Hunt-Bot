// WordHuntScreenActions v1: opt-in portrait screen-coordinate paths.
// Normal W3C action handling is unchanged unless the client supplies the opt-in flag.
+ (id<FBResponsePayload>)handleWordHuntScreenActions:(FBRouteRequest *)request
{
  NSArray *sources = request.arguments[@"actions"];
  NSDictionary *viewport = request.arguments[@"wordHuntViewport"];
  double width = [viewport[@"width"] doubleValue];
  double height = [viewport[@"height"] doubleValue];
  if (![sources isKindOfClass:NSArray.class] || sources.count != 1 ||
      !isfinite(width) || !isfinite(height) || width <= 0 || height <= width) {
    return FBResponseWithUnknownError([NSError errorWithDomain:@"WordHunt" code:1 userInfo:@{NSLocalizedDescriptionKey:@"Expected one touch pointer and portrait viewport"}]);
  }
  NSDictionary *source = sources.firstObject;
  NSArray *items = source[@"actions"];
  if (![source[@"type"] isEqual:@"pointer"] ||
      ![source[@"parameters"][@"pointerType"] isEqual:@"touch"] ||
      ![items isKindOfClass:NSArray.class] || items.count > 4096) {
    return FBResponseWithUnknownError([NSError errorWithDomain:@"WordHunt" code:2 userInfo:@{NSLocalizedDescriptionKey:@"Unsupported action source"}]);
  }
  XCUIApplication *application = request.session.activeApplication;
  if (application.interfaceOrientation != UIInterfaceOrientationPortrait) {
    return FBResponseWithUnknownError([NSError errorWithDomain:@"WordHunt" code:3 userInfo:@{NSLocalizedDescriptionKey:@"Screen-coordinate gestures require portrait orientation"}]);
  }
  XCSynthesizedEventRecord *record = [[XCSynthesizedEventRecord alloc] initWithName:@"Word Hunt screen paths" interfaceOrientation:UIInterfaceOrientationPortrait];
  XCPointerEventPath *path = nil;
  CGPoint point = CGPointZero;
  BOOL hasPoint = NO;
  double offset = 0;
  for (NSDictionary *item in items) {
    NSString *type = item[@"type"];
    double duration = [item[@"duration"] doubleValue] / 1000.0;
    if (!isfinite(duration) || duration < 0 || duration > 10 || offset + duration > 90) {
      return FBResponseWithUnknownError([NSError errorWithDomain:@"WordHunt" code:4 userInfo:@{NSLocalizedDescriptionKey:@"Invalid action duration"}]);
    }
    if ([type isEqual:@"pointerMove"]) {
      double x = [item[@"x"] doubleValue], y = [item[@"y"] doubleValue];
      if (![item[@"origin"] isEqual:@"viewport"] || !isfinite(x) || !isfinite(y) || x < 0 || x >= width || y < 0 || y >= height) {
        return FBResponseWithUnknownError([NSError errorWithDomain:@"WordHunt" code:5 userInfo:@{NSLocalizedDescriptionKey:@"Invalid viewport coordinate"}]);
      }
      offset += duration;
      point = CGPointMake(x,y);
      hasPoint = YES;
      if (path != nil) [path moveToPoint:point atOffset:offset];
    } else if ([type isEqual:@"pointerDown"] && hasPoint && path == nil) {
      path = [[XCPointerEventPath alloc] initForTouchAtPoint:point offset:offset];
    } else if ([type isEqual:@"pointerUp"] && path != nil) {
      [path liftUpAtOffset:offset];
      [record addPointerEventPath:path];
      path = nil;
    } else if ([type isEqual:@"pause"]) {
      offset += duration;
    } else {
      return FBResponseWithUnknownError([NSError errorWithDomain:@"WordHunt" code:6 userInfo:@{NSLocalizedDescriptionKey:@"Invalid pointer sequence"}]);
    }
  }
  if (path != nil) {
    return FBResponseWithUnknownError([NSError errorWithDomain:@"WordHunt" code:7 userInfo:@{NSLocalizedDescriptionKey:@"Pointer was not released"}]);
  }
  NSError *error = nil;
  if (![FBXCTestDaemonsProxy synthesizeEventWithRecord:record error:&error]) return FBResponseWithUnknownError(error);
  return FBResponseWithObject(@{@"wordHuntScreenCoordinates":@YES});
}
