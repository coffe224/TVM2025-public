import { Expr } from "../../lab04";
import { cost } from "./cost";

function exprEquals(a: Expr, b: Expr): boolean {
    switch (a.type) {
        case 'add_op':
        case 'sub_op':
        case 'mul_op':
        case 'div_op':
            if (b.type !== a.type) return false;
            return exprEquals(a.left_arg, b.left_arg) && exprEquals(a.right_arg, b.right_arg);
        
        case 'unary_min':
            if (b.type !== 'unary_min') return false;
            return exprEquals(a.arg, b.arg);
        
        case 'variable':
            if (b.type !== 'variable') return false;
            return a.value === b.value;
        
        case 'number':
            if (b.type !== 'number') return false;
            return a.value === b.value;
    }
}

function copyExpr(e: Expr): Expr {
    switch (e.type) {
        case 'number':
            return { type: 'number', value: e.value };
        case 'variable':
            return { type: 'variable', value: e.value };
        case 'unary_min':
            return { type: 'unary_min', arg: copyExpr(e.arg) };
        case 'add_op':
        case 'sub_op':
        case 'mul_op':
        case 'div_op':
            return { type: e.type, left_arg: copyExpr(e.left_arg), right_arg: copyExpr(e.right_arg) };
    }
}

function substitute(expr: Expr, pattern: Expr, replacement: Expr): Expr | null {
    // Check if expr matches the pattern
    if (exprEquals(expr, pattern)) {
        return copyExpr(replacement);
    }
    
    // Recursively substitute in sub-expressions
    switch (expr.type) {
        case 'number':
        case 'variable':
            return null;
        
        case 'unary_min':
            const newArg = substitute(expr.arg, pattern, replacement);
            if (newArg !== null) {
                return { type: 'unary_min', arg: newArg };
            }
            break;
        
        case 'add_op':
        case 'sub_op':
        case 'mul_op':
        case 'div_op':
            const newLeft = substitute(expr.left_arg, pattern, replacement);
            const newRight = substitute(expr.right_arg, pattern, replacement);
            
            if (newLeft !== null || newRight !== null) {
                return {
                    type: expr.type,
                    left_arg: newLeft !== null ? newLeft : copyExpr(expr.left_arg),
                    right_arg: newRight !== null ? newRight : copyExpr(expr.right_arg)
                };
            }
            break;
    }
    
    return null;
}

// Helper to check if an expression is zero
function isZero(expr: Expr): boolean {
    return expr.type === 'number' && expr.value === 0;
}

export function simplify(expr: Expr, identities: [Expr, Expr][]): Expr {
    
    // First, recursively simplify sub-expressions
    let simplified = copyExpr(expr);
    
    switch (simplified.type) {
        case 'unary_min':
            simplified = { type: 'unary_min', arg: simplify(simplified.arg, identities) };
            break;
            
        case 'add_op':
        case 'sub_op':
        case 'mul_op':
        case 'div_op':
            simplified = {
                type: simplified.type,
                left_arg: simplify(simplified.left_arg, identities),
                right_arg: simplify(simplified.right_arg, identities)
            };
            break;
    }
    
    
    // Now try to apply identities to the simplified expression
    let bestExpr = simplified;
    let bestCost = cost(simplified);
    
    // Special handling for operations with zero
    if (simplified.type === 'add_op' || simplified.type === 'sub_op') {
        if (isZero(simplified.right_arg)) {
            const newExpr = simplified.left_arg;
            const newCost = cost(newExpr);
            if (newCost < bestCost) {
                bestExpr = copyExpr(newExpr);
                bestCost = newCost;
            }
        }
    }
    
    if (simplified.type === 'mul_op') {
        // If either side is zero, the result is zero
        if (isZero(simplified.left_arg) || isZero(simplified.right_arg)) {
            const zeroExpr = { type: 'number' as const, value: 0 };
            const zeroCost = cost(zeroExpr);
            if (zeroCost < bestCost) {
                bestExpr = zeroExpr;
                bestCost = zeroCost;
            }
        }
    }
    
    // Try each identity
    for (let i = 0; i < identities.length; i++) {
        const [pattern, replacement] = identities[i];
        const newExpr = substitute(simplified, pattern, replacement);
        
        if (newExpr !== null) {
            // Recursively simplify the result
            const recursivelySimplified = simplify(newExpr, identities);
            const newCost = cost(recursivelySimplified);
            
            if (newCost < bestCost) {
                bestExpr = recursivelySimplified;
                bestCost = newCost;
            }
        } else {
        }
    }
    return bestExpr;
}