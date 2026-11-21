"""Install a reversible, opt-in WDA screen-coordinate experiment."""
import argparse
from pathlib import Path


def patch(wda):
    source=Path(wda)/'WebDriverAgentLib/Commands/FBTouchActionCommands.m'
    original=source.read_text()
    body=(Path(__file__).parent/'wda_screen_actions.inc').read_text()
    if 'WordHuntScreenActions v1' in original:
        if body in original:
            print('WDA screen-coordinate experiment already installed')
            return
        original=source.with_suffix('.m.wordhunt-original').read_text()
    marker='+ (id<FBResponsePayload>)handlePerformW3CTouchActions:(FBRouteRequest *)request\n{'
    if original.count(marker)!=1 or original.count('@end')!=1:
        raise ValueError('Unexpected WDA source layout; refusing to patch')
    backup=source.with_suffix('.m.wordhunt-original')
    if backup.exists() and backup.read_text()!=original:
        raise ValueError('An existing WDA backup needs review before another source version is patched')
    imports='\n#import <math.h>\n#import "XCPointerEventPath.h"\n#import "XCSynthesizedEventRecord.h"\n#import "XCUIApplication.h"\n#import "FBXCTestDaemonsProxy.h"\n'
    updated=original.replace('@implementation FBTouchActionCommands',imports+'\n@implementation FBTouchActionCommands')
    updated=updated.replace(marker,marker+'\n  if ([request.arguments[@"wordHuntScreenCoordinates"] boolValue]) return [self handleWordHuntScreenActions:request];')
    updated=updated.replace('@end',body+'\n@end')
    backup.write_text(original)
    source.write_text(updated)
    print(f'Installed opt-in WDA experiment. Original retained: {backup}')


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('wda',type=Path)
    args=parser.parse_args()
    patch(args.wda)
