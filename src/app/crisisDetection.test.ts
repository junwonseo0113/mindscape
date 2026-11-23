import { describe, expect, it } from "vitest";
import { detectCrisisSignal } from "./crisisDetection";

describe("crisis detection (Korean)", () => {
  it.each([
    "요즘 진짜 죽고 싶어", "죽고싶다는 생각만 들어", "그냥 죽고만 싶다", "다 죽어버리고 싶어",
    "자살 생각이 자꾸 나", "극단적인 선택을 할까 봐 무서워", "목숨을 끊고 싶어",
    "그냥 사라지고 싶다", "없어지고 싶어", "더 이상 살고 싶지 않아", "살기 싫어",
    "살 이유가 없어", "사는 게 의미가 없어", "살아서 뭐해", "태어나지 말았어야 했어",
    "차라리 죽는 게 나아", "내가 없으면 다들 편할 거야", "유서를 썼어", "옥상에서 뛰어내리고 싶어",
    "자해를 했어", "손목을 그었어", "나를 해치고 싶어", "수면제를 한꺼번에 먹을까", "인생을 끝내고 싶어",
  ])("detects %s", (text) => expect(detectCrisisSignal(text)).toBe(true));

  it.each([
    "오늘 회의가 길어서 피곤했다", "과제를 다 끝내고 싶다", "배고파 죽겠다는 말은 안 했어",
    "산책하고 나니 기분이 좋아졌어", "친구랑 저녁 먹었어",
  ])("does not flag %s", (text) => expect(detectCrisisSignal(text)).toBe(false));
});
