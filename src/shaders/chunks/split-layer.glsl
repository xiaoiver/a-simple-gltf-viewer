#define LAYER_RANGE_START 0.3
#define LAYER_RANGE_END 0.7
#define LAYER_NUM 6.0
#define LAYER_WIDTH (LAYER_RANGE_END - LAYER_RANGE_START) / LAYER_NUM
#define LAYER_OFFSET 0.1

// edge function
// https://www.scratchapixel.com/lessons/3d-basic-rendering/rasterization-practical-implementation/rasterization-stage
bool edgeFunction(vec2 a, vec2 b, vec2 c) {
    return (c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x) >= 0.;
}