# Random Number Generator
**ID:** random_number_generator  
**Version:** 1.0.0  
**Fee:** Free (0.01 USDC)  
**Description:**  
Random integers, floats and array sampling with deterministic seeding. Useful inside ACP agent workflows.

Provides tools:
- `random_int(min:number, max:number, seed?:string|number)`
- `random_float(min:number, max:number, seed?:string|number)`
- `sample(items:any[], count:number, seed?:string|number)`

## Install

1) Add this directory to OpenClaw config (`~/.openclaw/openclaw.json`):

```json
{
  "skills": {
    "load": {
      "extraDirs": ["/absolute/path/to/random_number_generator"]
    }
  }
}

## Limits
- Common: `min >= 0`
- `random_int`: `max < Number.MAX_SAFE_INTEGER` and both `min`/`max` must be integers
- `random_float`: `max < Number.MAX_VALUE` (upper bound exclusive)
- `sample`: `items.length <= 100`, `count <= items.length`
