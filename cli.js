import { readFileSync } from 'fs';
import acorn from 'acorn';
import walk from 'acorn-walk';
import { inspect } from 'util';
import { EventRules } from './events';

const [, , ...args] = process.argv;

let script = readFileSync(args[0]);
let availableGlobal = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
let availablePlayer = [...availableGlobal];

let programTree = acorn.parse(script);

let scriptTree = {
    rules: [
        {
            event: 'ONGOING - GLOBAL',
            conditions: [],
            actions: []
        }
    ],
    symbols: {}
}

walk.recursive(programTree, scriptTree, {
    VariableDeclarator(node, state, c) {
        state.step = 'set-global';
        c(node.id, state);
        let variable = state.variable;
        state.step = 'value'
        c(node.init, state);
        if (state.valueCommand) {
            state.rules[state.rules.length - 1].actions.push(`SET GLOBAL VARIABLE (${state.symbols[variable].variable}, ${state.valueCommand})`);
        }
    },
    Identifier(node, state, c) {
        if (state.step == "set-global") {
            state.symbols[node.name] = { type: 'value', variable: availableGlobal.shift() }
            state.variable = node.name
        } else if (state.step == "obj-prop") {
            state.symbols[state.variable].properties[node.name] = { index: state.objIndex };
        } else if (state.step == 'value') {
            if (state.symbols[node.name]) {
                let variableName = state.symbols[node.name].variable;
                state.valueCommand = `GLOBAL VARIABLE(${variableName})`
            } else {
                throw new Error(`Undefined variable start: ${node.start}, end: ${node.end}`)
            }
        }
    },
    Literal(node, state, c) {
        if (state.step == 'value') {
            if (typeof node.value == 'number') {
                state.valueCommand = `NUMBER(${node.value})`
            }
        } else {
            throw new Error(`Wrong step ${node.start}, ${node.end}`);
        }
    },
    ArrayExpression(node, state, c) {

        state.symbols[state.variable].type = 'array';

        state.rules[state.rules.length - 1].actions.push(`SET GLOBAL VARIABLE (${state.symbols[state.variable].variable}, EMPTY ARRAY())`);

        let appendActions = node.elements.map(e => {
            state.step = 'value';
            c(e, state);
            return `APPEND TO ARRAY(${state.symbols[state.variable].variable}, ${state.valueCommand})`;
        });
        state.rules[state.rules.length - 1].actions = state.rules[state.rules.length - 1].actions.concat(appendActions);

        state.valueCommand = null;
    },
    AssignmentExpression(node, state, c) {
        state.step = 'set-global';
        c(node.left, state);
        let variable = state.variable;
        state.step = 'value';
        c(node.right, state);
        if (state.valueCommand) {
            state.rules[state.rules.length - 1].actions.push(`SET GLOBAL VARIABLE (${state.symbols[variable].variable}, ${state.valueCommand})`);
        }
    },
    ObjectExpression(node, state, c) {
        state.symbols[state.variable].properties = {};
        state.symbols[state.variable].type = 'object';

        state.rules[state.rules.length - 1].actions.push(`SET GLOBAL VARIABLE (${state.symbols[state.variable].variable}, EMPTY ARRAY())`);

        let appendActions = node.properties.map((p, i) => {
            state.step = 'obj-prop';
            state.objIndex = i;
            c(p.key, state);
            state.step = 'value';
            c(p.value, state)
            return `APPEND TO ARRAY(${state.symbols[state.variable].variable}, ${state.valueCommand})`;
        });

        state.rules[state.rules.length - 1].actions = state.rules[state.rules.length - 1].actions.concat(appendActions);

        state.valueCommand = null;
    },
    CallExpression(node, state, c) {
        state.step = 'call';
        c(node.callee, state);

        if (EventRules[state.callName]) {
            if (state.rules[state.rules.length - 1].actions.length > 0) {
                state.rules.push(EventRules[state.callName]);
            } else {
                state.rules[state.rules.length - 1] = EventRules[state.callName];
            }

            state.step = 'event'
        }
    },
    FunctionExpression(node, state, c) {
        if (state.step == 'event') {
            c(node.body, state)
            if (state.rules[state.rules.length - 1].actions.length > 0) {
                state.rules.push(EventRules['onGoingGlobal']);
            } else {
                state.rules[state.rules.length - 1] = EventRules['onGoingGlobal'];
            }
        }
    },
    ArrowFunctionExpression(node, state, c) {
        if (state.step == 'event') {
            c(node.body, state)
            if (state.rules[state.rules.length - 1].actions.length > 0) {
                state.rules.push(EventRules['onGoingGlobal']);
            } else {
                state.rules[state.rules.length - 1] = EventRules['onGoingGlobal'];
            }
        }
    }
});

console.log(inspect(scriptTree, false, null, true))


// let scriptTree = {}

// function walk(programTree) {
//     let programBody = programTree.body;

//     programBody.forEach(node => {
//         if (node.type == 'VariableDeclaration') {
//             return declareVariable(node.declarations);
//         }
//     });
// }

// function declareVariable(declarations) {
//     declarations.forEach(declaration => {
//         let identifier = declaration.id.name;
//         let value = declaration.init.value;
//     });
// }