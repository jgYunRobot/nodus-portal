# Portal Operation Page Consolidation Design

## 1. 결정

2026-08-09부터 Portal의 robot-scoped 작업 페이지는 `Operation` 하나만 제공한다.

- 기존 Jogging 페이지의 3D robot model, real-time values와 Jog 리모컨을 그대로 유지한다.
- 페이지 이름과 canonical route를 `Operation`으로 변경한다.
- 별도 Operating 페이지와 navigation 항목은 제거한다.
- `Jogging`은 페이지 이름이 아니라 Operation 안의 continuous jog 기능 이름으로만 유지한다.

이 문서는 다음 기존 설계의 Jogging/Operating 페이지 이름과 route 부분을 대체한다.

- `src_nodus_portal_navigation_and_multi_robot_home_design.md`
- `src_shell_robot_dock_design.md`
- `src_nodus_portal_frontend_detailed_architecture_and_phased_implementation_design.md`

RobotStatus, Pilot operation, hold-to-run, Robot Dock와 multi-robot 격리 계약은 변경하지 않는다.

## 2. Route 계약

| Route | 동작 |
|---|---|
| `/robots/:control_id/operation` | canonical Operation 페이지 |
| `/robots/:control_id/jogging` | 같은 Control의 `/operation`으로 replace redirect |
| `/robots/:control_id/operating` | 같은 Control의 `/operation`으로 replace redirect |

legacy redirect는 저장된 bookmark와 browser history 호환만 담당한다. Sidebar, Home 카드와 Robot
Dock은 canonical `/operation`만 생성한다. redirect route에는 별도 page bundle이나 command owner를
두지 않는다.

## 3. Operation 페이지

Operation은 기존 Jogging workspace를 이름만 바꿔 사용한다.

유지하는 기능:

- explicit route `control_id`
- Portal-owned robot profile 선택
- lazy Three.js/URDF robot scene
- real-time position, velocity, torque와 acceleration
- joint/task Jog 리모컨
- Home/Ready continuous hold-to-run
- reset-origin과 operation feedback
- Robot Dock이 소유하는 Servo, Fault Reset과 Brake command

변경하는 presentation:

- 페이지 heading: `Jogging`에서 `Operation`
- Sidebar item: `Jogging`, `Operating` 두 개에서 `Operation` 한 개
- Home action: `Open Jogging`에서 `Open Operation`
- page module: `jogging_page`에서 `operation_page`

`Continuous jogging controls` 접근성 이름과 `features/operations` 내부 domain 이름은 실제 기능을
설명하므로 변경하지 않는다. 이 rename에서 operation scheduler, hold session, target projector나
Pilot request payload를 수정하지 않는다.

## 4. Robot 선택과 상태 격리

Robot Dock에서 Control을 변경하면 현재 Operation page kind를 유지한다.

```text
/robots/control-a/operation
  -> select control-b
/robots/control-b/operation
```

기존 switch transaction을 그대로 사용한다.

1. prior Control의 hold intent를 끝낸다.
2. unsent coalesced target을 폐기한다.
3. URL의 Control ID를 교체한다.
4. destination Control로 workspace를 remount한다.
5. destination status, model과 real-time values만 표시한다.

global Home과 Devices route는 변경하지 않는다. RobotDirectory가 성공적으로 비어 있으면 Operation
navigation은 disabled 상태이며 direct robot route는 기존처럼 Home으로 이동한다.

## 5. 구현 범위

### 포함

- router의 canonical Operation route와 두 legacy redirect
- Sidebar navigation 단일화
- Home card action 이름과 target 변경
- Robot route-preserving helper를 `operation` 한 종류로 축소
- 기존 Jogging page/module 이름을 Operation으로 변경
- Operating page source와 stylesheet 제거
- route, Home, Robot Dock와 visualization regression fixture 갱신
- 관련 progress 기록

### 제외

- Jog 버튼 동작, 속도, hold cadence와 target 계산 변경
- RobotStatus subscription 변경
- Pilot session, operation request나 component identity 변경
- Robot Dock command 변경
- 3D model, Camera, Device와 Vision 기능 변경
- physical robot 실행

## 6. 검증 기준

- Sidebar에는 `Operation`만 있고 `Jogging`과 `Operating` page link가 없다.
- Home action은 exact Control의 `/operation`을 가리킨다.
- direct `/operation` reload가 같은 Control과 page를 복원한다.
- legacy `/jogging`과 `/operating`은 같은 Control의 `/operation`으로 replace redirect된다.
- Robot Dock switch가 `/operation` page kind를 유지한다.
- 빈 RobotDirectory에서 Operation navigation과 direct route가 기존 제한을 유지한다.
- Operation에 기존 3D scene, real-time values와 `Continuous jogging controls`가 남아 있다.
- Home/shell bundle에 Three.js를 새로 포함하지 않는다.
- Operating page source와 lazy bundle이 남아 있지 않다.
- Device 페이지의 기존 작업 트리 변경에는 영향을 주지 않는다.
