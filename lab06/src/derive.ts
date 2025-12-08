import { Expr } from "../../lab04";

export function derive(e: Expr, varName: string): Expr
{
    console.log("Entered the derive function with type: " + e.type);

    switch(e.type) {
        case 'add_op':
        {
            const new_expr : Expr = {type: 'add_op', args: [], ops: []};

            new_expr.args.push(derive(e.args[0], varName));

            for (let i = 0; i < e.ops.length; i++) {
                new_expr.ops.push(e.ops[i]);
                new_expr.args.push(derive(e.args[i + 1], varName))
            }
            return new_expr;
        }


        case 'mul_op':
        {
            if (e.args.length == 1) {
                return {type: 'mul_op', ops: [], args: [derive(e.args[0], varName)]};
            }

            const f_expr : Expr = e.args[0];
            const f_deriv_expr : Expr = derive(f_expr, varName);


            const g_expr : Expr = {type: 'mul_op', ops: e.ops.slice(1), args: e.args.slice(1)};
            const g_deriv_expr : Expr = derive(g_expr, varName);

            const f_deriv_times_g : Expr = {type: 'mul_op', ops: ['*'], args: [f_deriv_expr, g_expr]};
            const f_times_g_deriv : Expr = {type: 'mul_op', ops: ['*'], args: [f_expr, g_deriv_expr]};

            // надо ли тут создавать тип mul_op 
            if (e.ops[0] == '*') {
                const new_expr : Expr = {
                    type: 'add_op',
                    ops: ['+'],
                    args: [f_deriv_times_g, f_times_g_deriv]
                }
                return new_expr;
            } else if (e.ops[0] == '/') {
                const new_expr : Expr = {
                    type: 'mul_op',
                    ops: ['/'],
                    args: [{
                        type: 'add_op',
                        ops: ['-'],
                        args: [f_deriv_times_g, f_times_g_deriv]
                    },{
                        type: 'mul_op',
                        ops: ['*'],
                        args: [g_expr, g_expr]
                    }]
                }
                return new_expr;
            } else {
                throw Error;
            }
        }

        case 'variable':
        {
            console.log("Varname: " + varName + " | Variable: " + e.value);
            const new_expr : Expr = {type: 'number', value: 0}
            if (e.value == varName) {
                console.log(e.value);
                new_expr.value = 1;
            }
            return new_expr;
        }

        case 'brac_expr':
        {
            const new_expr : Expr = {type: 'brac_expr', arg: derive(e.arg, varName)};
            return new_expr;
        }

        case 'unary_min':
        {
            const new_expr : Expr = {type: 'unary_min', arg: derive(e.arg, varName)};
            return new_expr;
        }

        case 'number':
        {
            console.log("Number: " + e.value);
            const new_expr : Expr = {type: 'number', value: 0}
            return new_expr;
        }


    }
}
function isZero(e: Expr): boolean { throw "Not implemented"}

function isOne(e: Expr): boolean  { throw "Not implemented"}
